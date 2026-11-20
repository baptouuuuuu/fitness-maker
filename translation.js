export async function translateInstructions(steps, translatorApi = globalThis.Translator) {
  if (!translatorApi) throw new Error('Traduction indisponible');
  const options = {sourceLanguage:'en', targetLanguage:'fr'};
  if (await translatorApi.availability(options) === 'unavailable') throw new Error('Traduction indisponible');
  const translator = await translatorApi.create(options);
  try {
    const translated = [];
    for (const step of steps) {
      const text = await translator.translate(step);
      if (!text.trim()) throw new Error('Traduction vide');
      translated.push(text);
    }
    return translated;
  } finally {
    translator.destroy();
  }
}
