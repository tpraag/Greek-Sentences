import { useState, useRef, useEffect } from 'react'
import { useApp } from '../store'
import { translateWordCached, normalizeWord } from '../lib/wordCache'
import { getCachedObjectUrl } from '../lib/audioCache'
import ConfirmSheet from '../components/ConfirmSheet'
import { GREEK_VOICES, ENGLISH_VOICES } from '../lib/voices'
import InterlinearGreek from '../components/InterlinearGreek'
import type { GreekSpeed } from '../types'
import styles from './SentenceDetail.module.css'

interface Props {
  sentenceId: string
  collectionId: string
  onBack: () => void
  fromPlayer?: boolean     // opened from the player — the back link then says "Player"
  onMoved: (newCollectionId: string) => void   // the sentence now lives in another collection
}

export default function SentenceDetail({ sentenceId, collectionId, onBack, fromPlayer, onMoved }: Props) {
  const { state, updateSentence, translateSentence, generateAudio, deleteSentence, moveSentence, startPlayback, showToast } = useApp()
  const [speed, setSpeed] = useState<GreekSpeed>(state.settings.greekSpeed)
  const [loop, setLoop] = useState(false)
  const [_playingLang, setPlayingLang] = useState<'en' | 'gr' | null>(null)
  const [wordCache, setWordCache] = useState<Record<string, string>>({})
  const [popover, setPopover] = useState<{ word: string; translation: string; loading: boolean } | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [editMode, setEditMode] = useState(false)
  const [editEn, setEditEn] = useState('')
  const [editGr, setEditGr] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingVoice, setPendingVoice] = useState<{ lang: 'en' | 'gr'; voiceId: string } | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [narrating, setNarrating] = useState<'en' | 'gr' | null>(null)
  // Opened from the player: preview here without touching the player's own paused session.
  // (Hooks stay above the early return below — the sentence can vanish mid-render when it's
  // deleted or moved, and a hook after that return would crash the page.)
  const previewRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => () => { previewRef.current?.pause() }, [])

  const sentences = state.sentences[collectionId] ?? []
  const idx = sentences.findIndex(s => s.id === sentenceId)
  const sentence = sentences[idx]
  const col = state.collections.find(c => c.id === collectionId)

  if (!sentence) return null

  const cached = !!(sentence.enAudioUrl && sentence.grAudioUrl)

  const narratorRows = [
    { lang: 'en' as const, label: 'English', voices: ENGLISH_VOICES, recorded: sentence.enVoiceId, fallback: state.settings.enVoiceId, audioUrl: sentence.enAudioUrl },
    { lang: 'gr' as const, label: 'Greek', voices: GREEK_VOICES, recorded: sentence.grVoiceId, fallback: state.settings.grVoiceId, audioUrl: sentence.grAudioUrl },
  ].filter(r => r.lang === 'en' || !!sentence.gr)

  async function playPreview(lang: 'en' | 'gr') {
    const url = lang === 'en' ? sentence.enAudioUrl : sentence.grAudioUrl
    if (!url) { showToast('No audio yet for this sentence'); return }
    if (!previewRef.current) previewRef.current = new Audio()
    const el = previewRef.current
    el.pause()
    el.src = (await getCachedObjectUrl(url)) ?? url
    el.playbackRate = lang === 'gr' ? speed : 1
    el.play().catch(() => showToast('Could not play this audio'))
  }

  async function play(lang: 'en' | 'gr') {
    if (fromPlayer) { playPreview(lang); return }
    setPlayingLang(lang)
    try {
      startPlayback(collectionId, [sentenceId], {
        order: lang,
        gapSeconds: 0,
        view: 'compact',
        greekSpeed: speed,
      })
    } finally {
      setPlayingLang(null)
    }
  }

  async function handleWordTap(word: string) {
    const clean = normalizeWord(word)
    if (!clean) return
    if (wordCache[clean]) {
      setPopover({ word: clean, translation: wordCache[clean], loading: false })
      return
    }
    setPopover({ word: clean, translation: '', loading: true })
    try {
      const translation = await translateWordCached(clean)
      setWordCache(c => ({ ...c, [clean]: translation }))
      setPopover({ word: clean, translation, loading: false })
    } catch {
      setPopover({ word: clean, translation: 'Could not translate', loading: false })
    }
  }

  function openEdit() {
    setEditEn(sentence.en)
    setEditGr(sentence.gr ?? '')
    setEditMode(true)
  }

  async function handleEditSave() {
    setSaving(true)
    const enChanged = editEn.trim() !== sentence.en
    const grChanged = editGr.trim() !== (sentence.gr ?? '')
    try {
      if (enChanged) {
        const retranslate = confirm('You changed the English text. Re-translate to Greek?')
        if (retranslate) {
          await updateSentence(sentenceId, collectionId, { en: editEn.trim(), gr: null, enAudioUrl: null, grAudioUrl: null })
          await translateSentence(sentenceId, collectionId)
          // regenerate both audio after translation completes
          if (state.settings.enVoiceId) await generateAudio(sentenceId, collectionId, 'en')
          const updated = (state.sentences[collectionId] ?? []).find(s => s.id === sentenceId)
          if (updated?.gr && state.settings.grVoiceId) await generateAudio(sentenceId, collectionId, 'gr')
        } else {
          // just save the new English text, regenerate EN audio
          await updateSentence(sentenceId, collectionId, { en: editEn.trim(), enAudioUrl: null })
          if (state.settings.enVoiceId) await generateAudio(sentenceId, collectionId, 'en')
        }
      } else if (grChanged) {
        // Only Greek changed — save and regenerate GR audio
        await updateSentence(sentenceId, collectionId, { gr: editGr.trim(), grAudioUrl: null })
        if (state.settings.grVoiceId) await generateAudio(sentenceId, collectionId, 'gr')
      }
      showToast('Saved')
      setEditMode(false)
    } catch {
      showToast('Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleRetranslate() {
    await updateSentence(sentenceId, collectionId, { gr: null, grAudioUrl: null })
    await translateSentence(sentenceId, collectionId)
  }

  async function handleRegenAudio() {
    await updateSentence(sentenceId, collectionId, { enAudioUrl: null, grAudioUrl: null })
    if (sentence.en) await generateAudio(sentenceId, collectionId, 'en')
    if (sentence.gr) await generateAudio(sentenceId, collectionId, 'gr')
  }

  async function handleMove(newCollectionId: string) {
    if (newCollectionId === collectionId) return
    try {
      await moveSentence(sentenceId, collectionId, newCollectionId)
      onMoved(newCollectionId)
      showToast(`Moved to ${state.collections.find(c => c.id === newCollectionId)?.name ?? 'collection'}`)
    } catch {
      showToast('Could not move the sentence')
    }
  }

  // Re-narrates one language with a different voice. Sentences remember their narrator, so
  // later regenerations (after an edit, say) keep it.
  async function handleChangeVoice() {
    if (!pendingVoice) return
    const { lang, voiceId } = pendingVoice
    setPendingVoice(null)
    setNarrating(lang)
    try {
      await generateAudio(sentenceId, collectionId, lang, voiceId)
      showToast('Narrator changed')
    } catch {
      showToast('Could not change the narrator')
    } finally {
      setNarrating(null)
    }
  }

  async function handleDelete() {
    setConfirmingDelete(false)
    await deleteSentence(sentenceId, collectionId)
    showToast('Sentence deleted')
    onBack()
  }

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        {editMode ? (
          <>
            <button className={styles.back} onClick={() => setEditMode(false)}>Cancel</button>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Edit sentence</span>
            <button className={styles.back} onClick={handleEditSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        ) : (
          <>
            <button className={styles.back} onClick={onBack}>
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 1 1 7 7 13"/>
              </svg>
              {fromPlayer ? 'Player' : col?.name}
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className={styles.back} onClick={openEdit} style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Edit</button>
              <button
                className={styles.favBtn}
                onClick={() => updateSentence(sentenceId, collectionId, { fav: !sentence.fav })}
              >
                <span style={{ color: sentence.fav ? 'var(--fav)' : 'var(--ink-placeholder)', fontSize: 22 }}>
                  {sentence.fav ? '★' : '☆'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      <div className={`screen-scroll ${state.playback.active ? 'with-player' : ''}`}>
        <div className={styles.body}>
          <div className={styles.counter}>English · {idx + 1} of {sentences.length}</div>
          {editMode ? (
            <>
              <textarea
                className={styles.editTextarea}
                value={editEn}
                onChange={e => setEditEn(e.target.value)}
                rows={4}
              />
              <div className="hairline" style={{ margin: '20px 0' }} />
              <div className={styles.counter}>Ελληνικά</div>
              <textarea
                className={`${styles.editTextarea} serif`}
                value={editGr}
                onChange={e => setEditGr(e.target.value)}
                rows={4}
                placeholder="Greek translation…"
              />
            </>
          ) : (
          <>
          <p className={styles.en}>{sentence.en}</p>

          <div className="hairline" style={{ margin: '20px 0' }} />

          <div className={styles.counter}>Ελληνικά</div>
          {sentence.translating ? (
            <p className={styles.translating}>Translating…</p>
          ) : sentence.gr ? (
            <div style={{ position: 'relative' }}>
              <p className={`${styles.gr} serif`} onClick={() => setPopover(null)}>
                <InterlinearGreek
                  text={sentence.gr}
                  showPhonetics={state.settings.showPhonetics}
                  onWordTap={handleWordTap}
                  stackClassName={styles.wordStack}
                  wordClassName={styles.grWord}
                  phoneticClassName={styles.phonetic}
                />
              </p>
              {popover && (
                <div ref={popoverRef} className={styles.popover}>
                  <span className={styles.popoverWord}>{popover.word}</span>
                  <span className={styles.popoverArrow}>→</span>
                  <span className={styles.popoverTranslation}>
                    {popover.loading ? '…' : popover.translation}
                  </span>
                  <button className={styles.popoverClose} onClick={() => setPopover(null)}>✕</button>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.notTranslated}>Not yet translated</p>
          )}

          {/* Play buttons */}
          <div className={styles.playRow}>
            <button
              className={styles.playEn}
              onClick={() => play('en')}
              disabled={!sentence.enAudioUrl && !sentence.en}
            >
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                <polygon points="1 1 13 8 1 15"/>
              </svg>
              English
            </button>
            <button
              className={styles.playGr}
              onClick={() => play('gr')}
              disabled={!sentence.gr}
            >
              <svg width="14" height="16" viewBox="0 0 14 16" fill="currentColor">
                <polygon points="1 1 13 8 1 15"/>
              </svg>
              Ελληνικά
            </button>
          </div>

          {/* Collection */}
          <div className={styles.narrator}>
            <span className={styles.controlLabel}>Collection</span>
            <div className={styles.narratorRow}>
              <span className={styles.narratorLang}>Lives in</span>
              <select
                className={styles.voiceSelect}
                value={collectionId}
                onChange={e => handleMove(e.target.value)}
              >
                {state.collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Narrator */}
          <div className={styles.narrator}>
            <span className={styles.controlLabel}>Narrator</span>
            {narratorRows.map(({ lang, label, voices, recorded, fallback, audioUrl }) => {
              // Sentences narrated before voices were recorded have no record of who narrated
              // them, so those show the current Settings voice, marked as assumed
              const current = recorded ?? fallback
              const knownVoice = !current || voices.some(v => v.id === current)
              return (
                <div key={lang} className={styles.narratorRow}>
                  <span className={styles.narratorLang}>{label}</span>
                  {narrating === lang ? (
                    <span className={styles.narratorBusy}>Narrating…</span>
                  ) : (
                    <span className={styles.narratorPick}>
                      {!recorded && <span className={styles.assumed}>{audioUrl ? 'assumed' : 'default'}</span>}
                      <select
                        className={styles.voiceSelect}
                        value={current ?? ''}
                        onChange={e => e.target.value && e.target.value !== current && setPendingVoice({ lang, voiceId: e.target.value })}
                        disabled={narrating !== null}
                      >
                        {!current && <option value="">No voice set</option>}
                        {!knownVoice && <option value={current}>Other voice</option>}
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Greek speed */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Greek speed</span>
            <div className="segmented">
              {([0.7, 0.85, 1.0] as GreekSpeed[]).map(s => (
                <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
                  {s === 1.0 ? '1×' : `${s}×`}
                </button>
              ))}
            </div>
          </div>

          {/* Loop */}
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>Loop this sentence</span>
            <label className="switch">
              <input type="checkbox" checked={loop} onChange={e => setLoop(e.target.checked)} />
              <div className="switch-track" />
            </label>
          </div>

          {/* Cache indicator */}
          {cached && (
            <div className={styles.cached}>
              <div className={styles.cachedDot} />
              Translation & audio cached
            </div>
          )}

          {/* Re-generate buttons */}
          <div className={styles.regenRow}>
            <button className="btn-outline" onClick={handleRetranslate}>Re-translate</button>
            <button className="btn-outline" onClick={handleRegenAudio}>Regenerate audio</button>
          </div>

          {/* Delete sentence — kept away from the regenerate buttons, quiet, and confirmed */}
          <div className={styles.dangerZone}>
            <button className={styles.deleteBtn} onClick={() => setConfirmingDelete(true)}>Delete this sentence…</button>
          </div>
          </>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmSheet
          title="Delete this sentence?"
          message="It will be removed permanently, along with its narration."
          confirmLabel="Delete sentence"
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      {pendingVoice && (
        <ConfirmSheet
          title="Change the narrator?"
          message={`The ${pendingVoice.lang === 'gr' ? 'Greek' : 'English'} audio for this sentence will be narrated again by ${(pendingVoice.lang === 'gr' ? GREEK_VOICES : ENGLISH_VOICES).find(v => v.id === pendingVoice.voiceId)?.name ?? 'this voice'}. This uses ElevenLabs credits.`}
          confirmLabel="Change narrator"
          onConfirm={handleChangeVoice}
          onCancel={() => setPendingVoice(null)}
        />
      )}
    </div>
  )
}
