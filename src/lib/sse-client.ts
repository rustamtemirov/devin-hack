export async function parseSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (type: string, data: unknown) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      let type = "message";
      let data = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) type = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) {
        let parsed: unknown = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          // keep raw string
        }
        onEvent(type, parsed);
      }
    }
  }
}
