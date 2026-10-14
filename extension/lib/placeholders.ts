// The optimizer marks missing proof as [add: what to add]. Text with such a marker must not be saved.
export const hasPlaceholders = (texts: string[]) => texts.some((t) => /\[add:[^\]]*\]/i.test(t))
