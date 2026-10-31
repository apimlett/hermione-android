// Home (DS v0.2): HERMIONE masthead, search, the main agent, live run / approval metrics, what needs
// attention, the team roster and the bottom navigation.
import { Redirect, router, useFocusEffect } from "expo-router";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useReducedMotion, useSharedValue } from "react-native-reanimated";
import { Activity as ActivityIcon, ArrowRight, CalendarClock, CircleAlert, ChevronRight, Home as HomeIcon, LayoutGrid, Palette, Plus, Search, Settings, ShieldCheck, Star, UserRound, X } from "lucide-react-native";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Bot } from "../src/backend";
import { useActivity, useApp, useAttentionChats, useLastAt, useMood, usePreview, useTotalUnread, useUnread, useUnreadBots } from "../src/app-state";
import { Avatar, BottomNav, Eyebrow, Metric, StatusChip, botStatus } from "../src/ui/kit";
import { Skeleton } from "../src/ui/motion";
import { selectAttentionItems } from "../src/ui/attention-items";
import { AttentionCarousel } from "../src/ui/attention-carousel";
import { isFailing } from "../src/job-text";
import { useLoad } from "../src/use-load";

import { Sheet, SheetRow } from "../src/ui/sheet";
import { relTime } from "../src/ui/time";
import { colors, font, layout, radii, type } from "../src/ui/theme";

const open = (b: Bot) => router.push(`/bot/${encodeURIComponent(b.id)}`);

export default function Home() {
  const { ready, backend, bots, botsLoaded, botsError, demo, primaryId, setPrimary, reloadBots } = useApp();
  const chats = useAttentionChats();
  const unread = useTotalUnread();
  const unreadIds = useUnreadBots();
  // With hermes-bridge the roster is the server's profile list: refresh it whenever Home shows again.
  const focusedBefore = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focusedBefore.current) void reloadBots();
    else focusedBefore.current = true; // AppProvider already starts the initial roster request.
  }, [reloadBots]));
  const notice = backend?.notice?.() ?? null;
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [menuFor, setMenuFor] = useState<Bot | null>(null);
  const [grid, setGrid] = useState(false);
  const listRef = useRef<FlatList<Bot>>(null);
  const scrollY = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const onListScroll = useAnimatedScrollHandler({ onScroll: (event) => { scrollY.set(event.contentOffset.y); } });
  const toTop = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: !reducedMotion }), [reducedMotion]);
  const primary = bots.find((b) => b.id === primaryId) ?? bots[0];
  const query = q.trim().toLowerCase();
  const others = useMemo(() => (query
    ? bots.filter((b) => `${b.name} ${b.description ?? ""} ${b.profile ?? ""}`.toLowerCase().includes(query))
    : bots.filter((b) => b.id !== primary?.id)), [bots, primary, query]);
  const onLong = useCallback((b: Bot) => setMenuFor(b), []);
  const firstUnread = useMemo(() => {
    const ids = new Set(unreadIds ? unreadIds.split(",") : []);
    return bots.find((bot) => ids.has(bot.id));
  }, [bots, unreadIds]);
  const routineFailures = useLoad(backend && !query && bots.length && bots.length <= 12 ? async () => {
    const all = await Promise.all(bots.map(async (bot) => {
      try {
        return (await backend.listJobs(bot)).filter(isFailing).map((job) => ({ botId: bot.id, jobId: job.id, name: job.name, detail: job.lastError }));
      } catch { return []; }
    }));
    return all.flat();
  } : null, [backend, query, bots.map((bot) => bot.id).join(",")]);
  const attention = useMemo(() => selectAttentionItems(chats, Date.now(), {
    loading: !botsLoaded,
    unread: unread > 0 && firstUnread ? { botId: firstUnread.id, count: unread } : undefined,
    routines: routineFailures.data ?? [],
  }), [chats, botsLoaded, unread, firstUnread, routineFailures.data]);
  // Match the actionable approval selector: only the latest active streaming turn can be waiting.
  const approvalCount = attention.counts.approval;
  const activeRuns = Object.values(chats).filter((chat) => chat.busy).length;
  const openActivity = () => { if (primary) router.push(`/activity/${encodeURIComponent(primary.id)}`); };

  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;
  if (!backend) return <Redirect href="/settings" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}>
      {demo ? <View style={{ paddingHorizontal: layout.gutter, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.rule, borderLeftWidth: 4, borderLeftColor: colors.waiting }}>
        <Text style={[type.label, { color: colors.warning }]}>Offline preview · sample bots and messages</Text>
        <Text style={[type.caption, { marginTop: 3 }]}>Hermione POC · not connected to a server</Text>
      </View> : null}

      <Animated.FlatList
        ref={listRef}
        data={others} keyExtractor={(b) => b.id} keyboardShouldPersistTaps="handled"
        onScroll={onListScroll} scrollEventThrottle={16}
        ListHeaderComponent={<View style={{ paddingHorizontal: layout.gutter, gap: 18, paddingTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text accessibilityRole="header" style={type.hero}>Hermione</Text>
              <Eyebrow>Autonomous agents{"\n"}under your control</Eyebrow>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push("/preferences")} style={({ pressed }) => [square, { backgroundColor: pressed ? colors.surfaceAlt : "transparent" }]}>
              <UserRound size={22} color={colors.text} strokeWidth={1.75} />
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderRadius: radii.inset, paddingHorizontal: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule }}>
            <Search size={18} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={demo ? "Search · Demo" : "Search"} placeholderTextColor={colors.muted} accessibilityLabel="Search bots"
              style={{ flex: 1, color: colors.text, fontFamily: font.regular, fontSize: 15, paddingVertical: 0, minHeight: 46 }} />
            {q ? <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ("")}><X size={18} color={colors.muted} /></Pressable> : null}
          </View>

          {notice ? <Notice text={notice} onSettings={() => router.push("/settings")} /> : null}

          {!query && primary ? <MainAgent bot={primary} onLong={onLong} /> : null}

          {!query && bots.length ? <>
            <View style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.rule }}>
              <Metric value={activeRuns} label="Active runs" a11y={`${activeRuns} active runs. View activity`} onPress={openActivity} icon={<ActivityIcon size={26} color={colors.coral} strokeWidth={1.75} />} />
              <View style={{ width: 1, marginVertical: 12, backgroundColor: colors.rule }} />
              <Metric value={approvalCount} label="Approvals" a11y={`${approvalCount} pending approvals`} icon={<ShieldCheck size={26} color={colors.coral} strokeWidth={1.75} />}
                onPress={() => { const approval = attention.items.find((item) => item.kind === "approval"); if (approval) router.push(approval.destination.path as any); }} />
            </View>
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
                <Text accessibilityRole="header" style={[type.civic, { fontSize: 24, lineHeight: 28 }]}>Needs attention</Text>
                <Eyebrow>{unread ? `${unread} unread` : "Live"}</Eyebrow>
              </View>
              <AttentionCarousel items={attention.items} bots={bots} loading={attention.loading} scrollY={scrollY} onSelectRing={toTop}
                onOpen={(item) => { if (item.destination) router.push(item.destination.path as any); }} />
            </View>
          </> : null}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.text, paddingBottom: 6 }}>
            <Text accessibilityRole="header" style={[type.civic, { fontSize: 24, lineHeight: 28 }]}>{query ? "Search results" : "Your team"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => setGrid(true)} hitSlop={4} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 48, paddingHorizontal: 6, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
                <LayoutGrid size={16} color={colors.text} strokeWidth={1.75} /><Eyebrow style={{ color: colors.text }}>More</Eyebrow>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Add a bot" onPress={() => router.push("/new-bot")} style={({ pressed }) => [square, { backgroundColor: pressed ? colors.coralPressed : colors.coral, borderColor: colors.coral }]}>
                <Plus size={24} color={colors.onCoral} strokeWidth={2.25} />
              </Pressable>
            </View>
          </View>
        </View>}
        renderItem={({ item }) => <BotRow bot={item} onLong={onLong} primary={item.id === primary?.id} />}
        ListEmptyComponent={query ? <Text style={[type.bodySm, { color: colors.muted, textAlign: "center", marginTop: 40 }]}>No bots match "{q.trim()}"</Text>
          : !botsLoaded && !bots.length ? <HomeSkeleton />
          : botsError && !bots.length ? <RosterError message={botsError} retry={() => { void reloadBots(); }} />
          : !primary ? <EmptyAssistants add={() => router.push("/new-bot")} />
          : <Text style={[type.bodySm, { color: colors.muted, marginHorizontal: layout.gutter, marginTop: 14 }]}>Only your main agent so far. Add a bot to grow the team.</Text>}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      <BottomNav active="home" bottomInset={insets.bottom} items={[
        { key: "home", label: "Home", icon: (c) => <HomeIcon size={20} color={c} strokeWidth={1.75} />, onPress: toTop },
        { key: "activity", label: "Activity", icon: (c) => <ActivityIcon size={20} color={c} strokeWidth={1.75} />, onPress: openActivity },
        { key: "settings", label: "Settings", icon: (c) => <Settings size={20} color={c} strokeWidth={1.75} />, onPress: () => router.push("/preferences") },
      ]} />
      <Sheet visible={!!menuFor} onClose={() => setMenuFor(null)}>
        {menuFor ? <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 10 }}>
            <Avatar bot={menuFor} size={40} badge={false} /><Text style={type.title} numberOfLines={1}>{menuFor.name}</Text>
          </View>
          {menuFor.id === primary?.id
            ? <SheetRow icon={<Star size={20} color={colors.coral} fill={colors.coral} />} label="This is your main agent" />
            : <SheetRow icon={<Star size={20} color={colors.text} />} label="Make main agent" onPress={() => { void setPrimary(menuFor.id); setMenuFor(null); }} />}
          <SheetRow icon={<Settings size={20} color={colors.textSecondary} />} label="Bot settings" onPress={() => { setMenuFor(null); router.push(`/bot-info/${menuFor.id}`); }} />
        </> : null}
      </Sheet>
      <Sheet visible={grid} onClose={() => setGrid(false)}>
        {[
          { label: "Add a bot", icon: Plus, path: "/new-bot" },
          { label: "Routines", icon: CalendarClock, path: "/routines" },
          { label: "Faces & colours", icon: Palette, path: "/faces" },
          { label: "Settings", icon: Settings, path: "/settings" },
        ].map(({ label, icon: Icon, path }) => (
          <SheetRow key={label} icon={<Icon size={20} color={colors.textSecondary} />} label={label} onPress={() => { setGrid(false); router.push(path as any); }} />
        ))}
      </Sheet>
    </View>
  );
}

const square = { width: 48, height: 48, borderRadius: 4, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" } as const;

/** DS HeroAgent: the main (primary) bot at the top of Home, the main route to its chat. */
function MainAgent({ bot, onLong }: { bot: Bot; onLong: (b: Bot) => void }) {
  const mood = useMood(bot.id), doing = useActivity(bot.id), unread = useUnread(bot.id), preview = usePreview(bot.id);
  const st = botStatus(mood, { needsKey: bot.needsKey, doing });
  const label = unread && st.status === "ready" ? `${unread} unread` : st.label;
  return (
    <Pressable onPress={() => open(bot)} onLongPress={() => onLong(bot)} accessibilityRole="button" accessibilityLabel={`Open chat with ${bot.name}, ${label}`}
      style={({ pressed }) => ({ padding: 16, gap: 12, borderRadius: radii.card, borderWidth: 1, borderColor: colors.ruleStrong, backgroundColor: pressed ? colors.surfaceAlt : colors.surface })}>
      <Eyebrow style={{ color: colors.text }}>Main agent</Eyebrow>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <Avatar bot={bot} size={64} mood={mood} badge={false} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={2} style={[type.display, { textTransform: "uppercase", fontSize: 28, lineHeight: 30 }]}>{bot.name}</Text>
          <StatusChip status={st.status} label={label} />
        </View>
        <ArrowRight size={26} color={colors.coral} strokeWidth={1.75} />
      </View>
      {preview || bot.description ? <Text numberOfLines={2} style={[type.bodySm, { color: colors.muted }]}>{preview || bot.description}</Text> : null}
    </Pressable>
  );
}

/** DS AgentRow: one flat ruled row; subscribes to its own bot's slices only, so streaming in one chat
 *  doesn't re-render the list. */
const BotRow = memo(function BotRow({ bot, onLong, primary }: { bot: Bot; onLong: (b: Bot) => void; primary: boolean }) {
  const n = useUnread(bot.id), preview = usePreview(bot.id), mood = useMood(bot.id), doing = useActivity(bot.id), at = useLastAt(bot.id);
  const st = botStatus(mood, { needsKey: bot.needsKey, doing });
  return (
    <Pressable onPress={() => open(bot)} onLongPress={() => onLong(bot)} accessibilityRole="button" accessibilityLabel={`Open ${bot.name}, ${st.label}${n ? `, ${n} unread` : ""}`}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 72, marginHorizontal: layout.gutter, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule, backgroundColor: pressed ? colors.surfaceAlt : "transparent" })}>
      <Avatar bot={bot} size={48} mood={mood} badge={false} />
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[type.body, { flexShrink: 1, fontFamily: font.display, fontWeight: "700", fontSize: 18, lineHeight: 22, textTransform: "uppercase" }]} numberOfLines={1}>{bot.name}</Text>
          {primary ? <Star size={13} color={colors.coral} fill={colors.coral} accessibilityLabel="Main agent" /> : null}
          {at ? <Text style={[type.eyebrow, { marginLeft: "auto", letterSpacing: 0.6, color: n ? colors.text : colors.muted }]}>{relTime(at)}</Text> : null}
        </View>
        <StatusChip status={st.status} label={st.status === "ready" ? (preview || bot.description || "Ready") : st.label} />
      </View>
      {n ? (
        <View accessibilityLabel={`${n} unread`} style={{ minWidth: 22, height: 22, borderRadius: 2, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.coral }}>
          <Text style={{ color: colors.onCoral, fontFamily: font.display, fontWeight: "700", fontSize: 13, lineHeight: 16 }}>{n > 99 ? "99+" : n}</Text>
        </View>
      ) : <ChevronRight size={20} color={colors.text} strokeWidth={1.75} />}
    </Pressable>
  );
});

/** Home's first load: rows shaped like bot rows (face, name, preview). */
function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading your bots" style={{ paddingTop: 8 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: layout.gutter, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          <Skeleton width={48} height={48} radius={radii.avatar} />
          <View style={{ flex: 1, gap: 8 }}><Skeleton width={`${46 - i * 6}%`} height={15} /><Skeleton width={`${80 - i * 8}%`} height={12} /></View>
        </View>
      ))}
    </View>
  );
}

function RosterError({ message, retry }: { message: string; retry: () => void }) {
  return <View accessibilityRole="alert" style={{ gap: 8, margin: layout.gutter, padding: 14, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderLeftWidth: 3, borderLeftColor: colors.failed }}>
    <Text style={[type.bodySm, { color: colors.textSecondary }]}>{message}</Text>
    <Pressable onPress={retry} accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }}><Text style={[type.bodySm, { color: colors.accentText, fontFamily: font.medium }]}>Retry</Text></Pressable>
  </View>;
}

function EmptyAssistants({ add }: { add: () => void }) {
  return <View style={{ alignItems: "center", gap: 8, marginHorizontal: 24, marginTop: 24, padding: 20 }}>
    <Text style={type.h}>No assistants yet</Text>
    <Text style={[type.bodySm, { color: colors.muted, textAlign: "center" }]}>Add an assistant to start a conversation.</Text>
    <Pressable onPress={add} accessibilityRole="button" style={({ pressed }) => ({ minHeight: 48, justifyContent: "center", paddingHorizontal: 18, marginTop: 6, borderRadius: radii.inset, backgroundColor: pressed ? colors.coralPressed : colors.coral })}>
      <Text style={{ color: colors.onCoral, fontFamily: font.display, fontWeight: "700", fontSize: 19, textTransform: "uppercase" }}>Add an assistant</Text>
    </Pressable>
  </View>;
}

/** A server notice (e.g. why hermes-bridge is off). Collapsed to 3 lines; tap to read all of it. */
function Notice({ text, onSettings }: { text: string; onSettings: () => void }) {
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }}
      accessibilityHint={open ? "Collapse" : "Show the whole message"}
      style={{ gap: 8, padding: 12, borderRadius: radii.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, borderLeftWidth: 3, borderLeftColor: colors.offline }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <CircleAlert size={16} color={colors.muted} style={{ marginTop: 1 }} />
        <Text selectable style={[type.label, { flex: 1 }]} numberOfLines={open ? undefined : 3}
          onTextLayout={(e) => { if (!open && e.nativeEvent.lines.length > 3) setClipped(true); }}>{text}</Text>
      </View>
      {open || clipped ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingLeft: 24 }}>
          <Text style={[type.label, { color: colors.accentText }]}>{open ? "Show less" : "Show more"}</Text>
          {open ? <Pressable onPress={onSettings} hitSlop={8} accessibilityRole="button"><Text style={[type.label, { color: colors.accentText }]}>Settings</Text></Pressable> : null}
        </View>
      ) : null}
    </Pressable>
  );
}
