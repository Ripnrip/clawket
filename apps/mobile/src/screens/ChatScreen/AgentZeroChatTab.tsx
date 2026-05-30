// Agent Zero chat tab.
//
// Reached when the active gateway config has backendKind === 'agentzero'.
// Self-contained: doesn't share the OpenClaw/Hermes WS gateway, no drawer,
// no sidebar (yet). Streams progressive log items via AgentZeroClient and
// renders them as bubbles. The full a0 CLI flavor (project switching, slash
// commands, agent profile picker) is intentionally deferred — those layer on
// top of this baseline.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RotateCcw, SendHorizontal } from 'lucide-react-native';
import { useAppContext } from '../../contexts/AppContext';
import { useAppTheme, type AppTheme } from '../../theme';
import { FontSize, FontWeight, Radius, Space } from '../../theme/tokens';
import {
  createAgentZeroClient,
  AgentZeroError,
  type AgentZeroLogItem,
} from '../../services/agentzero-client';

type Colors = AppTheme['colors'];

type BubbleAuthor = 'you' | 'agent' | 'tool' | 'system' | 'error';

interface ChatBubble {
  /** Stable id — for user messages we mint a uuid; for AZ items we reuse
   * the framework's log item id (or its `no` if id is null). */
  key: string;
  author: BubbleAuthor;
  /** Display text. */
  content: string;
  /** Optional short label rendered above the bubble (tool name, etc.). */
  heading?: string;
}

const AZ_TYPE_TO_AUTHOR: Record<string, BubbleAuthor> = {
  user: 'you',
  agent: 'agent',
  response: 'agent',
  tool: 'tool',
  util: 'tool',
  error: 'error',
};

function classifyLogItem(item: AgentZeroLogItem): BubbleAuthor {
  return AZ_TYPE_TO_AUTHOR[item.type] ?? 'system';
}

function mintKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentZeroChatTab(): React.JSX.Element {
  const { config } = useAppContext();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme]);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation(['chat', 'common']);

  const bridgeUrl = config?.agentzero?.bridgeUrl ?? '';
  const token = config?.token ?? '';
  const projectName = config?.agentzero?.projectName;

  const client = useMemo(
    () => (bridgeUrl && token
      ? createAgentZeroClient({ bridgeUrl, projectName }, token)
      : null),
    [bridgeUrl, token, projectName],
  );

  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [contextId, setContextId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<FlatList<ChatBubble>>(null);

  // Clean up any in-flight stream if the screen unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const appendBubble = useCallback((b: ChatBubble) => {
    setBubbles((prev) => [...prev, b]);
    // Defer scroll-to-end so FlatList has the new item.
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBubbles([]);
    setContextId(null);
    setSending(false);
  }, []);

  const handleSend = useCallback(async () => {
    if (!client) return;
    const text = draft.trim();
    if (!text || sending) return;

    appendBubble({ key: mintKey('user'), author: 'you', content: text });
    setDraft('');
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;
    // Dedupe per-stream: AZ's poll-window returns historical items too; the
    // client already filters by `no` cursor, but we additionally skip user
    // echoes (we just rendered the user bubble ourselves).
    const seen = new Set<string>();
    try {
      const final = await client.streamMessage(
        { message: text, contextId: contextId ?? undefined },
        (item) => {
          if (item.type === 'user') return;
          const key = item.id ?? `no-${item.no}`;
          if (seen.has(key)) return;
          seen.add(key);
          appendBubble({
            key,
            author: classifyLogItem(item),
            content: item.content,
            heading: item.heading || undefined,
          });
        },
        { pollIntervalMs: 400 },
        controller.signal,
      );
      setContextId(final.contextId);
    } catch (err) {
      const message = err instanceof AgentZeroError
        ? `${err.status}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
      appendBubble({ key: mintKey('err'), author: 'error', content: message });
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }, [appendBubble, client, contextId, draft, sending]);

  const renderItem: ListRenderItem<ChatBubble> = useCallback(({ item }) => (
    <View style={[styles.bubbleRow, item.author === 'you' && styles.bubbleRowRight]}>
      <View style={[styles.bubble, bubbleStyleByAuthor(styles, item.author)]}>
        {item.heading ? <Text style={styles.bubbleHeading}>{item.heading}</Text> : null}
        <Text style={[styles.bubbleText, bubbleTextStyleByAuthor(styles, item.author)]}>
          {item.content || ' '}
        </Text>
      </View>
    </View>
  ), [styles]);

  // Inline header (the shared ChatHeader is shaped for OpenClaw connection
  // state which doesn't apply to AZ's HTTP polling model).
  const headerTitle = t('Agent Zero');
  const headerSubtitle = projectName
    ? t('Project: {{name}}', { name: projectName })
    : undefined;

  if (!client) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{t('Connection not configured')}</Text>
          </View>
        </View>
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>
            {t('Set the Agent Zero base URL and Auth Token in Settings → Connections.')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
    >
      <View style={[styles.header, { paddingTop: insets.top + Space.sm }]}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          {headerSubtitle ? <Text style={styles.headerSubtitle}>{headerSubtitle}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Reset Chat')}
          onPress={resetChat}
          hitSlop={8}
          style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]}
        >
          <RotateCcw size={18} color={theme.colors.textMuted} strokeWidth={2} />
        </Pressable>
      </View>

      {bubbles.length === 0 && !sending ? (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyHintText}>
            {t('Say hi to Agent Zero. Streaming begins after your first message.')}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={bubbles}
          keyExtractor={(b) => b.key}
          renderItem={renderItem}
          contentContainerStyle={styles.bubbleList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      {sending ? (
        <View style={styles.sendingRow}>
          <ActivityIndicator size="small" color={theme.colors.textMuted} />
          <Text style={styles.sendingText}>{t('Agent Zero is working…')}</Text>
        </View>
      ) : null}

      <View style={[styles.composerWrap, { paddingBottom: Math.max(Space.md, insets.bottom) }]}>
        <TextInput
          style={styles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('Message Agent Zero')}
          placeholderTextColor={theme.colors.textSubtle}
          multiline
          editable={!sending}
          onSubmitEditing={handleSend}
          submitBehavior="blurAndSubmit"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Send')}
          onPress={handleSend}
          disabled={sending || !draft.trim()}
          style={({ pressed }) => [
            styles.sendButton,
            (sending || !draft.trim()) && styles.sendButtonDisabled,
            pressed && styles.sendButtonPressed,
          ]}
        >
          <SendHorizontal size={20} color={theme.colors.primaryText} strokeWidth={2.5} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function bubbleStyleByAuthor(s: ReturnType<typeof createStyles>, author: BubbleAuthor) {
  switch (author) {
    case 'you':    return s.bubbleYou;
    case 'agent':  return s.bubbleAgent;
    case 'tool':   return s.bubbleTool;
    case 'error':  return s.bubbleError;
    default:       return s.bubbleSystem;
  }
}

function bubbleTextStyleByAuthor(s: ReturnType<typeof createStyles>, author: BubbleAuthor) {
  switch (author) {
    case 'you':   return s.bubbleTextYou;
    case 'error': return s.bubbleTextError;
    default:      return s.bubbleTextAgent;
  }
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    emptyHint: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Space.xl,
    },
    emptyHintText: {
      color: colors.textMuted,
      fontSize: FontSize.base,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Space.lg,
      paddingBottom: Space.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    headerTextWrap: {
      flex: 1,
    },
    headerTitle: {
      color: colors.text,
      fontSize: FontSize.lg,
      fontWeight: FontWeight.semibold,
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    headerAction: {
      padding: Space.sm,
    },
    headerActionPressed: {
      opacity: 0.6,
    },
    bubbleList: {
      paddingHorizontal: Space.lg,
      paddingTop: Space.md,
      paddingBottom: Space.md,
    },
    bubbleRow: {
      flexDirection: 'row',
      marginBottom: Space.sm,
    },
    bubbleRowRight: {
      justifyContent: 'flex-end',
    },
    bubble: {
      maxWidth: '85%',
      paddingHorizontal: Space.md,
      paddingVertical: Space.sm,
      borderRadius: Radius.md,
    },
    bubbleYou: {
      backgroundColor: colors.primary,
    },
    bubbleAgent: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bubbleTool: {
      backgroundColor: colors.surfaceMuted,
    },
    bubbleSystem: {
      backgroundColor: colors.surfaceMuted,
    },
    bubbleError: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.error,
    },
    bubbleHeading: {
      color: colors.textMuted,
      fontSize: FontSize.xs,
      fontWeight: FontWeight.semibold,
      marginBottom: Space.xs,
      textTransform: 'uppercase',
    },
    bubbleText: {
      fontSize: FontSize.base,
      lineHeight: 20,
    },
    bubbleTextYou: {
      color: colors.primaryText,
    },
    bubbleTextAgent: {
      color: colors.text,
    },
    bubbleTextError: {
      color: colors.error,
    },
    sendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Space.sm,
      paddingHorizontal: Space.lg,
      paddingVertical: Space.xs,
    },
    sendingText: {
      color: colors.textMuted,
      fontSize: FontSize.sm,
    },
    composerWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: Space.sm,
      paddingHorizontal: Space.md,
      paddingTop: Space.sm,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    composerInput: {
      flex: 1,
      maxHeight: 120,
      paddingHorizontal: Space.md,
      paddingVertical: Space.sm,
      borderRadius: Radius.lg,
      backgroundColor: colors.surfaceMuted,
      color: colors.text,
      fontSize: FontSize.base,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: Radius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.4,
    },
    sendButtonPressed: {
      opacity: 0.7,
    },
  });
}
