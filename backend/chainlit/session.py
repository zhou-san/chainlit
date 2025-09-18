import asyncio
import json
import mimetypes
import re
import shutil
import uuid
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Deque,
    Dict,
    List,
    Literal,
    Optional,
    TypedDict,
    Union,
)

import aiofiles

from chainlit.logger import logger
from chainlit.types import AskFileSpec, FileReference

if TYPE_CHECKING:
    from chainlit.config import ChainlitConfig
    from chainlit.types import FileDict
    from chainlit.user import PersistedUser, User

ClientType = Literal["webapp", "copilot", "teams", "slack", "discord"]


class ContextData(TypedDict):
    """Data structure for storing context information."""

    id: str
    name: str
    description: Optional[str]
    associated_files: List[str]  # List of file IDs associated with this context
    active_files: List[str]  # List of currently active file IDs
    parameters: Dict[str, Any]  # Context-specific parameters
    created_at: str
    updated_at: str


class JSONEncoderIgnoreNonSerializable(json.JSONEncoder):
    def default(self, o):
        try:
            return super().default(o)
        except TypeError:
            return None


def clean_metadata(metadata: Dict, max_size: int = 1048576):
    cleaned_metadata = json.loads(
        json.dumps(metadata, cls=JSONEncoderIgnoreNonSerializable, ensure_ascii=False)
    )

    metadata_size = len(json.dumps(cleaned_metadata).encode("utf-8"))
    if metadata_size > max_size:
        # Redact the metadata if it exceeds the maximum size
        cleaned_metadata = {
            "message": f"Metadata size exceeds the limit of {max_size} bytes. Redacted."
        }

    return cleaned_metadata


class BaseSession:
    """Base object."""

    thread_id_to_resume: Optional[str] = None
    client_type: ClientType
    current_task: Optional[asyncio.Task] = None

    def __init__(
        self,
        # Id of the session
        id: str,
        client_type: ClientType,
        # Thread id
        thread_id: Optional[str],
        # Logged-in user information
        user: Optional[Union["User", "PersistedUser"]],
        # Logged-in user token
        token: Optional[str],
        # User specific environment variables. Empty if no user environment variables are required.
        user_env: Optional[Dict[str, str]],
        # WSGI environment variables for the connection request
        environ: Optional[dict[str, Any]] = None,
        # Chat profile selected before the session was created
        chat_profile: Optional[str] = None,
    ):
        if thread_id:
            self.thread_id_to_resume = thread_id
        self.thread_id = thread_id or str(uuid.uuid4())
        self.user = user
        self.client_type = client_type
        self.token = token
        self.has_first_interaction = False
        self.user_env = user_env or {}
        self.environ = environ or {}
        self.chat_profile = chat_profile

        self.files: Dict[str, FileDict] = {}
        self.files_spec: Dict[str, AskFileSpec] = {}

        self.id = id

        self.chat_settings: Dict[str, Any] = {}

        # Context management
        self.contexts: Dict[str, ContextData] = {}
        self.active_context: Optional[str] = None
        self.context_settings: Dict[str, Any] = {}

    @property
    def files_dir(self):
        from chainlit.config import FILES_DIRECTORY

        return FILES_DIRECTORY / self.id

    async def persist_file(
        self,
        name: str,
        mime: str,
        path: Optional[str] = None,
        content: Optional[Union[bytes, str]] = None,
    ) -> FileReference:
        if not path and not content:
            raise ValueError(
                "Either path or content must be provided to persist a file"
            )

        self.files_dir.mkdir(exist_ok=True)

        file_id = str(uuid.uuid4())

        # Use original filename instead of UUID, with proper sanitization
        import re
        from pathlib import Path

        # Sanitize the filename to prevent directory traversal and invalid characters
        sanitized_name = re.sub(r'[<>:"/\\|?*]', "_", name)
        sanitized_name = sanitized_name.strip(
            ". "
        )  # Remove leading/trailing dots and spaces

        # Ensure filename is not empty after sanitization or only contains underscores
        if not sanitized_name or sanitized_name.replace("_", "").strip() == "":
            sanitized_name = f"file_{file_id[:8]}"

        file_path = self.files_dir / sanitized_name

        # Handle filename conflicts by adding a counter suffix
        counter = 1
        original_file_path = file_path
        while file_path.exists():
            stem = original_file_path.stem
            suffix = original_file_path.suffix
            file_path = self.files_dir / f"{stem}_{counter}{suffix}"
            counter += 1

        if path:
            # Copy the file from the given path
            async with (
                aiofiles.open(path, "rb") as src,
                aiofiles.open(file_path, "wb") as dst,
            ):
                await dst.write(await src.read())
        elif content:
            # Write the provided content to the file
            async with aiofiles.open(file_path, "wb") as buffer:
                if isinstance(content, str):
                    content = content.encode("utf-8")
                await buffer.write(content)

        # Get the file size
        file_size = file_path.stat().st_size
        # Store the file content in memory
        self.files[file_id] = {
            "id": file_id,
            "path": file_path,
            "name": name,
            "type": mime,
            "size": file_size,
        }

        return {"id": file_id}

    def create_context(
        self,
        name: str,
        description: Optional[str] = None,
        parameters: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Create a new context."""
        from chainlit.utils import utc_now

        context_id = str(uuid.uuid4())
        self.contexts[context_id] = {
            "id": context_id,
            "name": name,
            "description": description,
            "associated_files": [],
            "active_files": [],
            "parameters": parameters or {},
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }

        # Set as active context if it's the first one
        if not self.active_context:
            self.active_context = context_id

        return context_id

    def switch_context(self, context_id: str) -> bool:
        """Switch to a different context."""
        if context_id in self.contexts:
            self.active_context = context_id
            return True
        return False

    def get_active_context(self) -> Optional[ContextData]:
        """Get the currently active context."""
        if self.active_context and self.active_context in self.contexts:
            return self.contexts[self.active_context]
        return None

    def add_file_to_context(self, context_id: str, file_id: str) -> bool:
        """Associate a file with a context."""
        if context_id in self.contexts and file_id in self.files:
            if file_id not in self.contexts[context_id]["associated_files"]:
                self.contexts[context_id]["associated_files"].append(file_id)
                self.contexts[context_id]["updated_at"] = self._get_current_time()
            return True
        return False

    def set_active_files_for_context(
        self, context_id: str, file_ids: List[str]
    ) -> bool:
        """Set which files are active for a specific context."""
        if context_id in self.contexts:
            # Validate that all file_ids are associated with this context
            associated_files = self.contexts[context_id]["associated_files"]
            valid_file_ids = [fid for fid in file_ids if fid in associated_files]

            self.contexts[context_id]["active_files"] = valid_file_ids
            self.contexts[context_id]["updated_at"] = self._get_current_time()
            return True
        return False

    def update_context_parameters(
        self, context_id: str, parameters: Dict[str, Any]
    ) -> bool:
        """Update parameters for a specific context."""
        if context_id in self.contexts:
            self.contexts[context_id]["parameters"].update(parameters)
            self.contexts[context_id]["updated_at"] = self._get_current_time()
            return True
        return False

    def _get_current_time(self) -> str:
        """Get current time as string."""
        from chainlit.utils import utc_now

        return utc_now()

    def to_persistable(self) -> Dict:
        from chainlit.config import config
        from chainlit.user_session import user_sessions

        user_session = user_sessions.get(self.id) or {}  # type: Dict
        user_session["chat_settings"] = self.chat_settings
        user_session["chat_profile"] = self.chat_profile
        user_session["client_type"] = self.client_type

        # Check config setting for whether to persist user environment variables
        user_session_copy = user_session.copy()
        if not config.project.persist_user_env:
            # Remove user environment variables (API keys) before persisting to database
            user_session_copy["env"] = {}

        metadata = clean_metadata(user_session_copy)
        return metadata


class HTTPSession(BaseSession):
    """Internal HTTP session object. Used to consume Chainlit through API (no websocket)."""

    def __init__(
        self,
        # Id of the session
        id: str,
        client_type: ClientType,
        # Thread id
        thread_id: Optional[str] = None,
        # Logged-in user information
        user: Optional[Union["User", "PersistedUser"]] = None,
        # Logged-in user token
        token: Optional[str] = None,
        user_env: Optional[Dict[str, str]] = None,
        # WSGI environment variables for the connection request
        environ: Optional[dict[str, Any]] = None,
    ):
        super().__init__(
            id=id,
            thread_id=thread_id,
            user=user,
            token=token,
            client_type=client_type,
            user_env=user_env,
            environ=environ,
        )

    async def delete(self):
        """Delete the session."""
        if self.files_dir.is_dir():
            shutil.rmtree(self.files_dir)


ThreadQueue = Deque[tuple[Callable, object, tuple, Dict]]


class WebsocketSession(BaseSession):
    """Internal web socket session object.

    A socket id is an ephemeral id that can't be used as a session id
    (as it is for instance regenerated after each reconnection).

    The Session object store an internal mapping between socket id and
    a server generated session id, allowing to persists session
    between socket reconnection but also retrieving a session by
    socket id for convenience.
    """

    to_clear: bool = False

    def __init__(
        self,
        # Id from the session cookie
        id: str,
        # Associated socket id
        socket_id: str,
        # Function to emit to the client
        emit: Callable[[str, Any], None],
        # Function to emit to the client and wait for a response
        emit_call: Callable[[Literal["ask", "call_fn"], Any, Optional[int]], Any],
        # User specific environment variables. Empty if no user environment variables are required.
        user_env: Dict[str, str],
        client_type: ClientType,
        # WSGI environment variables for the connection request
        environ: Optional[dict[str, Any]] = None,
        # Thread id
        thread_id: Optional[str] = None,
        # Logged-in user information
        user: Optional[Union["User", "PersistedUser"]] = None,
        # Logged-in user token
        token: Optional[str] = None,
        # Chat profile selected before the session was created
        chat_profile: Optional[str] = None,
    ):
        super().__init__(
            id=id,
            thread_id=thread_id,
            user=user,
            token=token,
            user_env=user_env,
            client_type=client_type,
            chat_profile=chat_profile,
            environ=environ,
        )

        self.socket_id = socket_id
        self.emit_call = emit_call
        self.emit = emit

        self.restored = False

        self.thread_queues: Dict[str, ThreadQueue] = {}

        match = (
            re.match(
                r"^\s*([a-zA-Z0-9-]+)", environ.get("HTTP_ACCEPT_LANGUAGE", "en-US")
            )
            if environ
            else None
        )
        self.language = match.group(1) if match else "en-US"

        self.config: ChainlitConfig = self.get_config()

        ws_sessions_id[self.id] = self
        ws_sessions_sid[socket_id] = self

    def get_config(self) -> "ChainlitConfig":
        """
        Return the config for this session: overridden if chat profile exists and has overrides, else global config.
        """
        from chainlit.config import config as global_config

        # If no chat profile, always fallback to global config
        if not self.chat_profile:
            return global_config
        # If already computed, use self.config
        if hasattr(self, "config") and self.config:
            return self.config
        # Try to compute overrides
        cfg = global_config
        if global_config.code.set_chat_profiles:
            import asyncio

            try:
                profiles = asyncio.get_event_loop().run_until_complete(
                    global_config.code.set_chat_profiles(self.user, self.language)
                )
                current_profile = next(
                    (p for p in profiles if p.name == self.chat_profile), None
                )
                if current_profile and getattr(
                    current_profile, "config_overrides", None
                ):
                    cfg = global_config.with_overrides(current_profile.config_overrides)
            except Exception:
                pass
        self.config = cfg
        return cfg

    def restore(self, new_socket_id: str):
        """Associate a new socket id to the session."""
        ws_sessions_sid.pop(self.socket_id, None)
        ws_sessions_sid[new_socket_id] = self
        self.socket_id = new_socket_id
        self.restored = True

    async def delete(self):
        """Delete the session."""
        if self.files_dir.is_dir():
            shutil.rmtree(self.files_dir)
        ws_sessions_sid.pop(self.socket_id, None)
        ws_sessions_id.pop(self.id, None)

    async def flush_method_queue(self):
        for method_name, queue in self.thread_queues.items():
            while queue:
                method, self, args, kwargs = queue.popleft()
                try:
                    await method(self, *args, **kwargs)
                except Exception as e:
                    logger.error(f"Error while flushing {method_name}: {e}")

    @classmethod
    def get(cls, socket_id: str):
        """Get session by socket id."""
        return ws_sessions_sid.get(socket_id)

    @classmethod
    def get_by_id(cls, session_id: str):
        """Get session by session id."""
        return ws_sessions_id.get(session_id)

    @classmethod
    def require(cls, socket_id: str):
        """Throws an exception if the session is not found."""
        if session := cls.get(socket_id):
            return session
        raise ValueError("Session not found")


ws_sessions_sid: Dict[str, WebsocketSession] = {}
ws_sessions_id: Dict[str, WebsocketSession] = {}
