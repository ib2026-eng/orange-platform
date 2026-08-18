/* Generateur pseudo-aleatoire deterministe (meme graine = memes valeurs a
   chaque appel) -- utilise pour la demo carte et les clients fictifs.
   Logique inchangee par rapport a la reference. */
export function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

export function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s % 10000) / 10000;
  };
}
