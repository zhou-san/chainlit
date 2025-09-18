import { debounce } from 'lodash';
import { useCallback, useContext, useEffect } from 'react';
import {
  useRecoilState,
  useRecoilValue,
  useResetRecoilState,
  useSetRecoilState
} from 'recoil';
import io from 'socket.io-client';
import { toast } from 'sonner';
import {
  actionState,
  askUserState,
  audioConnectionState,
  callFnState,
  chatProfileState,
  chatSettingsInputsState,
  chatSettingsValueState,
  commandsState,
  currentThreadIdState,
  elementState,
  firstUserInteraction,
  isAiSpeakingState,
  loadingState,
  mcpState,
  messagesState,
  resumeThreadErrorState,
  sessionIdState,
  sessionState,
  sideViewState,
  tasklistState,
  threadIdToResumeState,
  tokenCountState,
  wavRecorderState,
  wavStreamPlayerState
} from 'src/state';
import {
  IAction,
  ICommand,
  IElement,
  IMessageElement,
  IStep,
  ITasklistElement,
  IThread
} from 'src/types';
import {
  addMessage,
  deleteMessageById,
  updateMessageById,
  updateMessageContentById
} from 'src/utils/message';

import { OutputAudioChunk } from './types/audio';

import { ChainlitContext } from './context';
import type { IToken } from './useChatData';
import { configState } from './state';

const useChatSession = () => {
  const client = useContext(ChainlitContext);
  const sessionId = useRecoilValue(sessionIdState);
  const config = useRecoilValue(configState);

  const [session, setSession] = useRecoilState(sessionState);
  
  // Debug helper - only active when debug mode is enabled
  const debugEnabled = Boolean(config?.debug);
  const debug = {
    enabled: debugEnabled,
    log: (...args: any[]) => {
      if (debugEnabled) console.log('[Chainlit Debug]', ...args);
    },
    warn: (...args: any[]) => {
      if (debugEnabled) console.warn('[Chainlit Debug]', ...args);
    },
    error: (...args: any[]) => {
      if (debugEnabled) console.error('[Chainlit Debug]', ...args);
    },
    time: (label: string) => {
      if (debugEnabled) console.time(`[Chainlit Debug] ${label}`);
    },
    timeEnd: (label: string) => {
      if (debugEnabled) console.timeEnd(`[Chainlit Debug] ${label}`);
    }
  };

  // Stream metrics for debug monitoring (only created when debug is enabled)
  const streamMetrics = debugEnabled ? {
    tokensReceived: 0,
    lastTokenTime: Date.now(),
    streamStartTime: 0,
    messageUpdates: 0,
    fastTokens: 0,
    slowTokens: 0,
    connectionHealth: Date.now()
  } : null;
  const setIsAiSpeaking = useSetRecoilState(isAiSpeakingState);
  const setAudioConnection = useSetRecoilState(audioConnectionState);
  const resetChatSettingsValue = useResetRecoilState(chatSettingsValueState);
  const setChatSettingsValue = useSetRecoilState(chatSettingsValueState);
  const setFirstUserInteraction = useSetRecoilState(firstUserInteraction);
  const setLoading = useSetRecoilState(loadingState);
  const setMcps = useSetRecoilState(mcpState);
  const wavStreamPlayer = useRecoilValue(wavStreamPlayerState);
  const wavRecorder = useRecoilValue(wavRecorderState);
  const setMessages = useSetRecoilState(messagesState);
  const setAskUser = useSetRecoilState(askUserState);
  const setCallFn = useSetRecoilState(callFnState);
  const setCommands = useSetRecoilState(commandsState);
  const setSideView = useSetRecoilState(sideViewState);
  const setElements = useSetRecoilState(elementState);
  const setTasklists = useSetRecoilState(tasklistState);
  const setActions = useSetRecoilState(actionState);
  const setChatSettingsInputs = useSetRecoilState(chatSettingsInputsState);
  const setTokenCount = useSetRecoilState(tokenCountState);
  const [chatProfile, setChatProfile] = useRecoilState(chatProfileState);
  const idToResume = useRecoilValue(threadIdToResumeState);
  const setThreadResumeError = useSetRecoilState(resumeThreadErrorState);

  const [currentThreadId, setCurrentThreadId] =
    useRecoilState(currentThreadIdState);

  // Use currentThreadId as thread id in websocket header
  useEffect(() => {
    if (session?.socket) {
      session.socket.auth['threadId'] = currentThreadId || '';
    }
  }, [currentThreadId]);

  const _connect = useCallback(
    async ({
      transports,
      userEnv
    }: {
      transports?: string[];
      userEnv: Record<string, string>;
    }) => {
      const { protocol, host, pathname } = new URL(client.httpEndpoint);
      const uri = `${protocol}//${host}`;
      const path =
        pathname && pathname !== '/'
          ? `${pathname}/ws/socket.io`
          : '/ws/socket.io';

      try {
        await client.stickyCookie(sessionId);
      } catch (err) {
        console.error(`Failed to set sticky session cookie: ${err}`);
      }

      const socket = io(uri, {
        path,
        withCredentials: true,
        transports,
        auth: {
          clientType: client.type,
          sessionId,
          threadId: idToResume || '',
          userEnv: JSON.stringify(userEnv),
          chatProfile: chatProfile ? encodeURIComponent(chatProfile) : ''
        },
        // Reconnection settings
        reconnection: true, // Enable auto-reconnection
        reconnectionAttempts: Infinity, // Keep trying forever
        reconnectionDelay: 1000, // Start with 1 second
        reconnectionDelayMax: 5000, // Max 5 seconds between attempts
        randomizationFactor: 0.5, // Randomize delay by ±50%
        timeout: 20000 // Connection timeout (20s)
      });
      setSession((old) => {
        old?.socket?.removeAllListeners();
        old?.socket?.close();
        return {
          socket
        };
      });

      socket.on('connect', () => {
        debug.log('WebSocket connected', {
          transport: socket.io.engine.transport.name,
          sessionId,
          timestamp: new Date().toISOString()
        });
        socket.emit('connection_successful');
        setSession((s) => ({ ...s!, error: false, connectionStatus: 'connected' }));
        
        // Reset stream metrics on new connection
        if (streamMetrics) {
          streamMetrics.connectionHealth = Date.now();
          streamMetrics.tokensReceived = 0;
          streamMetrics.messageUpdates = 0;
        }
        setMcps((prev) =>
          prev.map((mcp) => {
            let promise;
            if (mcp.clientType === 'sse') {
              promise = client.connectSseMCP(sessionId, mcp.name, mcp.url!);
            } else if (mcp.clientType === 'streamable_http') {
              promise = client.connectStreamableHttpMCP(
                sessionId,
                mcp.name,
                mcp.url!
              );
            } else {
              promise = client.connectStdioMCP(
                sessionId,
                mcp.name,
                mcp.command!
              );
            }
            promise
              .then(async ({ success, mcp }) => {
                setMcps((prev) =>
                  prev.map((existingMcp) => {
                    if (existingMcp.name === mcp.name) {
                      return {
                        ...existingMcp,
                        status: success ? 'connected' : 'failed',
                        tools: mcp ? mcp.tools : existingMcp.tools
                      };
                    }
                    return existingMcp;
                  })
                );
              })
              .catch(() => {
                setMcps((prev) =>
                  prev.map((existingMcp) => {
                    if (existingMcp.name === mcp.name) {
                      return {
                        ...existingMcp,
                        status: 'failed'
                      };
                    }
                    return existingMcp;
                  })
                );
              });
            return { ...mcp, status: 'connecting' };
          })
        );
      });

      socket.on('connect_error', (_) => {
        setSession((s) => ({ ...s!, error: true, connectionStatus: 'failed' }));
      });

      socket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`);
        setSession((s) => ({ ...s!, error: false, connectionStatus: 'connected' }));
        // Clear any error states and re-establish connection
        toast.success('Connection restored!');
      });

      socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`);
        setSession((s) => ({ ...s!, connectionStatus: 'reconnecting' }));
        if (attemptNumber === 1) {
          toast.info('Connection lost, attempting to reconnect...');
        }
      });

      socket.on('reconnect_error', (error) => {
        console.error('Reconnection error:', error);
      });

      socket.on('reconnect_failed', () => {
        console.error('Failed to reconnect after all attempts');
        setSession((s) => ({ ...s!, error: true, connectionStatus: 'failed' }));
        toast.error('Unable to reconnect. Please refresh the page.');
      });

      socket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason);
        setSession((s) => ({ ...s!, connectionStatus: 'reconnecting' }));
        if (reason === 'io server disconnect') {
          // Server-initiated disconnect, try to reconnect
          socket.connect();
        }
        // Don't set error: true immediately on disconnect, let reconnection logic handle it
      });

      socket.on('task_start', () => {
        setLoading(true);
      });

      socket.on('task_end', () => {
        setLoading(false);
      });

      socket.on('reload', () => {
        socket.emit('clear_session');
        window.location.reload();
      });

      socket.on('audio_connection', async (state: 'on' | 'off') => {
        if (state === 'on') {
          let isFirstChunk = true;
          const startTime = Date.now();
          const mimeType = 'pcm16';
          // Connect to microphone
          await wavRecorder.begin();
          await wavStreamPlayer.connect();
          await wavRecorder.record(async (data) => {
            const elapsedTime = Date.now() - startTime;
            socket.emit('audio_chunk', {
              isStart: isFirstChunk,
              mimeType,
              elapsedTime,
              data: data.mono
            });
            isFirstChunk = false;
          });
          wavStreamPlayer.onStop = () => setIsAiSpeaking(false);
        } else {
          await wavRecorder.end();
          await wavStreamPlayer.interrupt();
        }
        setAudioConnection(state);
      });

      socket.on('audio_chunk', (chunk: OutputAudioChunk) => {
        wavStreamPlayer.add16BitPCM(chunk.data, chunk.track);
        setIsAiSpeaking(true);
      });

      socket.on('audio_interrupt', () => {
        wavStreamPlayer.interrupt();
      });

      socket.on('resume_thread', (thread: IThread) => {
        const isReadOnlyView = Boolean(
          (thread as any)?.metadata?.viewer_read_only
        );
        if (!isReadOnlyView && idToResume && thread.id !== idToResume) {
          window.location.href = `/thread/${thread.id}`;
        }
        if (!isReadOnlyView && idToResume) {
          setCurrentThreadId(thread.id);
        }
        let messages: IStep[] = [];
        for (const step of thread.steps) {
          messages = addMessage(messages, step);
        }
        if (thread.metadata?.chat_profile) {
          setChatProfile(thread.metadata?.chat_profile);
        }
        if (thread.metadata?.chat_settings) {
          setChatSettingsValue(thread.metadata?.chat_settings);
        }
        setMessages(messages);
        const elements = thread.elements || [];
        setTasklists(
          (elements as ITasklistElement[]).filter((e) => e.type === 'tasklist')
        );
        setElements(
          (elements as IMessageElement[]).filter(
            (e) => ['avatar', 'tasklist'].indexOf(e.type) === -1
          )
        );
      });

      socket.on('resume_thread_error', (error?: string) => {
        setThreadResumeError(error);
      });

      socket.on('new_message', (message: IStep) => {
        setMessages((oldMessages) => addMessage(oldMessages, message));
      });

      socket.on(
        'first_interaction',
        (event: { interaction: string; thread_id: string }) => {
          setFirstUserInteraction(event.interaction);
          setCurrentThreadId(event.thread_id);
        }
      );

      socket.on('update_message', (message: IStep) => {
        setMessages((oldMessages) =>
          updateMessageById(oldMessages, message.id, message)
        );
      });

      socket.on('delete_message', (message: IStep) => {
        setMessages((oldMessages) =>
          deleteMessageById(oldMessages, message.id)
        );
      });

      socket.on('stream_start', (message: IStep) => {
        debug.log('Stream started', {
          messageId: message.id,
          messageType: message.type,
          timestamp: new Date().toISOString()
        });
        
        if (streamMetrics) {
          streamMetrics.streamStartTime = Date.now();
          streamMetrics.tokensReceived = 0;
          streamMetrics.messageUpdates = 0;
        }
        
        setMessages((oldMessages) => addMessage(oldMessages, message));
      });

      socket.on(
        'stream_token',
        ({ id, token, isSequence, isInput }: IToken) => {
          const startTime = performance.now();
          
          // Debug tracking for streaming performance
          if (streamMetrics) {
            const now = Date.now();
            const timeSinceLastToken = now - streamMetrics.lastTokenTime;
            streamMetrics.tokensReceived++;
            streamMetrics.lastTokenTime = now;
            
            // Track token frequency patterns
            if (timeSinceLastToken < 10) {
              streamMetrics.fastTokens++;
            } else if (timeSinceLastToken > 1000) {
              streamMetrics.slowTokens++;
            }
            
            // Log concerning patterns
            if (streamMetrics.tokensReceived % 50 === 0) {
              const engine = socket.io.engine;
              debug.log('Streaming metrics update', {
                messageId: id,
                tokensReceived: streamMetrics.tokensReceived,
                timeSinceLastToken,
                fastTokens: streamMetrics.fastTokens,
                slowTokens: streamMetrics.slowTokens,
                socketBufferLength: engine.writeBuffer?.length || 0,
                transport: engine.transport?.name || 'unknown'
              });
            }
            
            // Warn about potential issues
            if (timeSinceLastToken < 5 && streamMetrics.fastTokens > 0 && streamMetrics.fastTokens % 10 === 0) {
              debug.warn('Very fast token streaming detected', {
                messageId: id,
                tokensInLast5ms: streamMetrics.fastTokens,
                timeSinceLastToken,
                bufferLength: socket.io.engine.writeBuffer?.length || 0
              });
            }
          }
          
          setMessages((oldMessages) =>
            updateMessageContentById(
              oldMessages,
              id,
              token,
              isSequence,
              isInput
            )
          );
          
          // Performance monitoring
          const updateTime = performance.now() - startTime;
          if (debugEnabled && updateTime > 16) {
            debug.warn('Slow token update detected', {
              messageId: id,
              updateTime: updateTime.toFixed(2) + 'ms',
              tokenLength: token.length,
              isSequence
            });
          }
        }
      );

      socket.on('ask', ({ msg, spec }, callback) => {
        setAskUser({ spec, callback, parentId: msg.parentId });
        setMessages((oldMessages) => addMessage(oldMessages, msg));

        setLoading(false);
      });

      socket.on('ask_timeout', () => {
        setAskUser(undefined);
        setLoading(false);
      });

      socket.on('clear_ask', () => {
        setAskUser(undefined);
      });

      socket.on('call_fn', ({ name, args }, callback) => {
        setCallFn({ name, args, callback });
      });

      socket.on('clear_call_fn', () => {
        setCallFn(undefined);
      });

      socket.on('call_fn_timeout', () => {
        setCallFn(undefined);
      });

      socket.on('chat_settings', (inputs: any) => {
        setChatSettingsInputs(inputs);
        resetChatSettingsValue();
      });

      socket.on('set_commands', (commands: ICommand[]) => {
        setCommands(commands);
      });

      socket.on('set_sidebar_title', (title: string) => {
        setSideView((prev) => {
          if (prev?.title === title) return prev;
          return { title, elements: prev?.elements || [] };
        });
      });

      socket.on(
        'set_sidebar_elements',
        ({ elements, key }: { elements: IMessageElement[]; key?: string }) => {
          if (!elements.length) {
            setSideView(undefined);
          } else {
            elements.forEach((element) => {
              if (!element.url && element.chainlitKey) {
                element.url = client.getElementUrl(
                  element.chainlitKey,
                  sessionId
                );
              }
            });
            setSideView((prev) => {
              if (prev?.key === key) return prev;
              return { title: prev?.title || '', elements: elements, key };
            });
          }
        }
      );

      socket.on('element', (element: IElement) => {
        if (!element.url && element.chainlitKey) {
          element.url = client.getElementUrl(element.chainlitKey, sessionId);
        }

        if (element.type === 'tasklist') {
          setTasklists((old) => {
            const index = old.findIndex((e) => e.id === element.id);
            if (index === -1) {
              return [...old, element];
            } else {
              return [...old.slice(0, index), element, ...old.slice(index + 1)];
            }
          });
        } else {
          setElements((old) => {
            const index = old.findIndex((e) => e.id === element.id);
            if (index === -1) {
              return [...old, element];
            } else {
              return [...old.slice(0, index), element, ...old.slice(index + 1)];
            }
          });
        }
      });

      socket.on('remove_element', (remove: { id: string }) => {
        setElements((old) => {
          return old.filter((e) => e.id !== remove.id);
        });
        setTasklists((old) => {
          return old.filter((e) => e.id !== remove.id);
        });
      });

      socket.on('action', (action: IAction) => {
        setActions((old) => [...old, action]);
      });

      socket.on('remove_action', (action: IAction) => {
        setActions((old) => {
          const index = old.findIndex((a) => a.id === action.id);
          if (index === -1) return old;
          return [...old.slice(0, index), ...old.slice(index + 1)];
        });
      });

      socket.on('token_usage', (count: number) => {
        setTokenCount((old) => old + count);
      });

      socket.on('window_message', (data: any) => {
        if (window.parent) {
          window.parent.postMessage(data, '*');
        }
      });

      socket.on('toast', (data: { message: string; type: string }) => {
        if (!data.message) {
          console.warn('No message received for toast.');
          return;
        }

        switch (data.type) {
          case 'info':
            toast.info(data.message);
            break;
          case 'error':
            toast.error(data.message);
            break;
          case 'success':
            toast.success(data.message);
            break;
          case 'warning':
            toast.warning(data.message);
            break;
          default:
            toast(data.message);
            break;
        }
      });

      socket.on('mcp_direct_update', (data: { action: string; mcp: any }) => {
        const { action, mcp } = data;

        switch (action) {
          case 'add':
            // Smart add: if MCP with same name exists, update it; otherwise add new
            setMcps((prev) => {
              const existingIndex = prev.findIndex((m) => m.name === mcp.name);
              if (existingIndex !== -1) {
                // Update existing MCP
                return prev.map((m, index) =>
                  index === existingIndex ? { ...m, ...mcp } : m
                );
              } else {
                // Add new MCP
                return [...prev, mcp];
              }
            });
            break;
          case 'remove':
            setMcps((prev) => prev.filter((m) => m.name !== mcp.name));
            break;
          case 'clear':
            setMcps([]);
            break;
        }
      });
    },
    [setSession, sessionId, idToResume, chatProfile]
  );

  const connect = useCallback(debounce(_connect, 200), [_connect]);

  const disconnect = useCallback(() => {
    if (session?.socket) {
      session.socket.removeAllListeners();
      session.socket.close();
    }
  }, [session]);

  return {
    connect,
    disconnect,
    session,
    sessionId,
    chatProfile,
    idToResume,
    setChatProfile
  };
};

export { useChatSession };
