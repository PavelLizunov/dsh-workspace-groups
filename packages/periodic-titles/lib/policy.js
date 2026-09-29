// Exact acknowledgments only: short topic names such as "DNS" still count.
const ACKNOWLEDGMENTS = new Set([
    'да', 'нет', 'ок', 'окей', 'хорошо', 'понятно', 'спасибо', 'продолжай', 'продолжить',
    'дальше', 'делай', 'согласен', 'утверждаю', 'yes', 'no', 'ok', 'okay', 'thanks',
    'continue', 'go ahead', 'proceed', 'approved',
]);
export function isSubstantive(text) {
    const normalized = text.trim().toLowerCase().replace(/[.!?,;:…]+$/u, '').trim();
    return normalized.length > 0 && !ACKNOWLEDGMENTS.has(normalized);
}
export function humanMessages(events) {
    const messages = [];
    for (const event of events) {
        if (event.type !== 'user/message' || event.data.source.kind !== 'user')
            continue;
        const text = event.data.content.filter(block => block.type === 'text').map(block => block.text).join('\n');
        if (isSubstantive(text))
            messages.push({ seq: event.seq, text });
    }
    return messages;
}
/** Match the native helper's framing, retaining exact messages and source seqs. */
export function titleInputBytes(messages) {
    return Buffer.byteLength(`Generate the session title from this JSON array of human messages:\n${JSON.stringify(messages)}`, 'utf8');
}
/** Recent whole messages first; include the original topic if there is room. */
export function selectTitleMessages(messages, maxBytes) {
    const substantive = messages.filter(message => isSubstantive(message.text));
    const selected = [];
    for (let index = substantive.length - 1; index >= 0; index--) {
        const message = substantive[index];
        if (titleInputBytes([message, ...selected]) <= maxBytes)
            selected.unshift(message);
    }
    // Never rename from stale context when the newest topic itself cannot fit.
    if (selected.at(-1)?.seq !== substantive.at(-1)?.seq)
        return [];
    return selected;
}
export function titleDue(messages, title, every) {
    if (title?.source.kind === 'user' || messages.length === 0)
        return false;
    if (title === undefined || title.source.kind === 'fallback')
        return true;
    const through = Math.max(-1, ...title.messageSeqs);
    return messages.filter(message => message.seq > through).length >= every;
}
