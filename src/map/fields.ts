/** onKeyDown for a text/number field that commits on blur: Enter blurs it (committing per keystroke remounts the input and drops focus). */
export const commitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };
