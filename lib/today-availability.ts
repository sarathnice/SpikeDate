export function tonightWindow(now = new Date()) {
  const end = new Date(now);
  if (now.getHours() >= 5) end.setDate(end.getDate() + 1);
  end.setHours(5, 0, 0, 0);
  const start = new Date(
    Math.max(now.getTime(), end.getTime() - 18 * 60 * 60 * 1000),
  );
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}
