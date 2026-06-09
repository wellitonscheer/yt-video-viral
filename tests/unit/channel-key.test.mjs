// Prova: extractChannelKey normaliza hrefs de canal para uma chave de cache estável.
// (channelKeyFromHref no background.js é código idêntico — duplicado deliberado.)

import { loadContentGlobals } from './load.mjs';

export default function (t) {
  const { extractChannelKey } = loadContentGlobals();

  const cases = [
    ['https://www.youtube.com/@MrBeast', '@MrBeast'],
    ['/@MrBeast', '@MrBeast'],
    ['/@MrBeast/videos', '@MrBeast'],
    ['/@x?si=abc123', '@x'],
    ['https://www.youtube.com/channel/UCabc123', 'channel/UCabc123'],
    ['/channel/UCabc123', 'channel/UCabc123'],
    ['/user/foo', 'user/foo'],
    ['/c/foo', 'c/foo'],
    [null, null],
    ['', null],
  ];

  for (const [href, expected] of cases) {
    t.eq(extractChannelKey(href), expected, `extractChannelKey(${JSON.stringify(href)})`);
  }
}
