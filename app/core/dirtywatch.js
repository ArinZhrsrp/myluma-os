// LUMA — core: dirtywatch
    // ----- edit popups: "Save" stays disabled until something has actually changed -----
    (function initDirtyWatch() {
      const sig = m => JSON.stringify([[...m.querySelectorAll('input,select,textarea')].map(el => el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value), [...m.querySelectorAll('.on,.sel,.active,.selected,.tk-item.done')].map(el => el.id + '|' + el.textContent.trim().slice(0, 30))]);
      const shown = id => { const e = document.getElementById(id); return !!e && e.style.display !== 'none'; };
      [
        ['calEventOverlay', 'calEvSave', () => shown('calEvDelete')],
        ['taskOverlay', 'tkSave', () => shown('tkDelete')],
        ['moneyEntryOverlay', 'mEntrySave', () => shown('mEntryDelete')],
        ['billOverlay', 'billSave', () => shown('billDelete')],
        ['goalOverlay', 'goalSave', () => shown('goalDelete')],
        ['habitOverlay', 'habitSave', () => shown('habitDelete')],
        ['reminderOverlay', 'crSave', () => shown('remDelete')],
        ['profileEditOverlay', 'pemSave', () => true],
        ['noteOverlay', 'noteSave', () => /edit/i.test((document.getElementById('noteHeading') || {}).textContent || '')],
        ['moneyIncomeOverlay', 'mIncSave', () => true],
        ['sdCourseOverlay', 'sdCourseSave', () => shown('sdCourseDelete')],
        ['sdClassOverlay', 'sdClassSave', () => shown('sdClassDelete')],
        ['sdTaskOverlay', 'sdTaskSave', () => shown('sdTaskDelete')],
        ['sdSemOverlay', 'sdSemSave', () => shown('sdSemDelete')],
        ['sdNoteOverlay', 'sdNoteSave', () => shown('sdNoteDelete') || (typeof SDN !== 'undefined' && SDN.mode === 'shared')],
        ['sdProjOverlay', 'sdProjSave', () => true],
      ].forEach(([ovId, saveId, isEdit]) => {
        const ov = document.getElementById(ovId), save = document.getElementById(saveId); if (!ov || !save) return;
        let base = null, was = false;
        const refresh = () => { if (base == null) return; save.disabled = sig(ov) === base; save.title = save.disabled ? 'Nothing has changed yet' : ''; };
        new MutationObserver(() => {
          const on = ov.classList.contains('open');
          if (on && !was && isEdit()) { base = null; save.disabled = true; setTimeout(() => { base = sig(ov); refresh(); }, 150); }
          if (!on && was) { base = null; save.disabled = false; }
          was = on;
        }).observe(ov, { attributes: true, attributeFilter: ['class'] });
        const later = () => setTimeout(refresh, 0);
        ov.addEventListener('input', later); ov.addEventListener('change', later); ov.addEventListener('click', later);
      });
    })();
