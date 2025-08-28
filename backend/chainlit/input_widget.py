import re
from abc import abstractmethod
from typing import Any, Dict, List, Optional

from pydantic import Field
from pydantic.dataclasses import dataclass

from chainlit.types import InputWidgetType


@dataclass
class InputWidget:
    id: str
    label: str
    initial: Any = None
    tooltip: Optional[str] = None
    description: Optional[str] = None

    def __post_init__(
        self,
    ) -> None:
        if not self.id or not self.label:
            raise ValueError("Must provide key and label to load InputWidget")

    @abstractmethod
    def to_dict(self) -> Dict[str, Any]:
        pass


@dataclass
class Switch(InputWidget):
    """Useful to create a switch input."""

    type: InputWidgetType = "switch"
    initial: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "tooltip": self.tooltip,
            "description": self.description,
        }


@dataclass
class Slider(InputWidget):
    """Useful to create a slider input."""

    type: InputWidgetType = "slider"
    initial: float = 0
    min: float = 0
    max: float = 10
    step: float = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "min": self.min,
            "max": self.max,
            "step": self.step,
            "tooltip": self.tooltip,
            "description": self.description,
        }


@dataclass
class Select(InputWidget):
    """Useful to create a select input."""

    type: InputWidgetType = "select"
    initial: Optional[str] = None
    initial_index: Optional[int] = None
    initial_value: Optional[str] = None
    values: List[str] = Field(default_factory=list)
    items: Dict[str, str] = Field(default_factory=dict)

    def __post_init__(
        self,
    ) -> None:
        super().__post_init__()

        if not self.values and not self.items:
            raise ValueError("Must provide values or items to create a Select")

        if self.values and self.items:
            raise ValueError(
                "You can only provide either values or items to create a Select"
            )

        if not self.values and self.initial_index is not None:
            raise ValueError(
                "Initial_index can only be used in combination with values to create a Select"
            )

        if self.items:
            self.initial = self.initial_value
        elif self.values:
            self.items = {value: value for value in self.values}
            self.initial = (
                self.values[self.initial_index]
                if self.initial_index is not None
                else self.initial_value
            )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "items": [
                {"label": id, "value": value} for id, value in self.items.items()
            ],
            "tooltip": self.tooltip,
            "description": self.description,
        }


@dataclass
class TextInput(InputWidget):
    """Useful to create a text input."""

    type: InputWidgetType = "textinput"
    initial: Optional[str] = None
    placeholder: Optional[str] = None
    multiline: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "placeholder": self.placeholder,
            "tooltip": self.tooltip,
            "description": self.description,
            "multiline": self.multiline,
        }


@dataclass
class NumberInput(InputWidget):
    """Useful to create a number input."""

    type: InputWidgetType = "numberinput"
    initial: Optional[float] = None
    placeholder: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "placeholder": self.placeholder,
            "tooltip": self.tooltip,
            "description": self.description,
        }


@dataclass
class Tags(InputWidget):
    """Useful to create an input for an array of strings."""

    type: InputWidgetType = "tags"
    initial: List[str] = Field(default_factory=list)
    values: List[str] = Field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type,
            "id": self.id,
            "label": self.label,
            "initial": self.initial,
            "tooltip": self.tooltip,
            "description": self.description,
        }


@dataclass
class SecureTags(Tags):
    """Enhanced Tags input that automatically detects and masks sensitive values like API keys"""

    type: InputWidgetType = "secure_tags"

    def _detect_sensitive_value(self, value: str) -> bool:
        """Auto-detect if a value looks sensitive based on patterns"""
        sensitive_patterns = [
            r"(?i).*key.*=.*",  # Anything with "key="
            r"(?i).*token.*=.*",  # Anything with "token="
            r"(?i).*secret.*=.*",  # Anything with "secret="
            r"(?i).*password.*=.*",  # Anything with "password="
            r"(?i).*api.*=.*",  # Anything with "api="
            r"(?i).*auth.*=.*",  # Anything with "auth="
            r"(?i).*bearer.*=.*",  # Anything with "bearer="
            r"(?i).*credential.*=.*",  # Anything with "credential="
        ]

        return any(re.search(pattern, value) for pattern in sensitive_patterns)

    def get_masked_value(self, tag_value: str) -> str:
        """Return masked version of a tag value for display"""
        if not self._detect_sensitive_value(tag_value):
            return tag_value

        if "=" in tag_value:
            key, value = tag_value.split("=", 1)
            masked_value = self._mask_string(value)
            return f"{key}={masked_value}"
        else:
            return self._mask_string(tag_value)

    def _mask_string(self, value: str) -> str:
        """Apply masking to a string value - show first 4 and last 4 chars"""
        if len(value) <= 8:
            return "*" * len(value)

        start_chars = value[:4]
        end_chars = value[-4:]
        middle_length = len(value) - 8
        middle_mask = "*" * max(4, middle_length)

        return f"{start_chars}{middle_mask}{end_chars}"

    def to_dict(self) -> Dict[str, Any]:
        """Include masking info in serialization"""
        base_dict = super().to_dict()
        base_dict.update({"is_secure": True, "auto_mask_sensitive": True})
        return base_dict
