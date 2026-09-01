// Curated ElevenLabs voices — hardcoded rather than user-managed, since only these
// have been vetted for pronunciation quality in each language.

export interface VoiceOption {
  id: string
  name: string
}

export const GREEK_VOICES: VoiceOption[] = [
  { id: 'ejJ1ETWS2ohLMMeCu1H3', name: 'Atlas' },
  { id: '7smwXrU3C1PfaspIIUZB', name: 'Sophia' },
  { id: '6z1Ks05MOtac6wYNh9PJ', name: 'Kyriakos' },
  { id: 'cuab90umcstNgL8U7orz', name: 'Fatsis' },
  { id: '0oYUKTNPbymIKVAkDQqh', name: 'Sofia' },
  { id: 'CsiIKWiAQRGMe7qh9P9q', name: 'Iordanis' },
  { id: 'KDImLuG6RkuyuX5httC7', name: 'Takis (good)' },
  { id: 'aTP4J5SJLQl74WTSRXKW', name: 'Eleni' },
  { id: 'mRTQIE2xdk2oMdoKFGJu', name: 'Aria' },
  { id: 'AnNshXL08po8KEaf53gz', name: 'Niki 1' },
  { id: 'wykE1oPxFaMrxdpOtFt6', name: 'Niki 2' },
  { id: 'TaxceJVmw8PImjbbbz3w', name: 'Christina' },
]

export const ENGLISH_VOICES: VoiceOption[] = [
  { id: 'tnSpp4vdxKPjI9w0GnoV', name: 'Hope' },
  { id: 'alFofuDn3cOwyoz1i44T', name: 'Dallin' },
  { id: '4YYIPFl9wE5c4L2eu2Gb', name: 'Burt Reynolds' },
  { id: 'Dslrhjl3ZpzrctukrQSN', name: 'Hey its Brad' },
  { id: 'Gubgw9l4dtIoQA9YZHgx', name: 'Brian' },
  { id: 'rCuVrCHOUMY3OwyJBJym', name: 'Mia' },
]
