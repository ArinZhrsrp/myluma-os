// LUMA — module: study
    // The Study add-on's home. Placeholder for now: shows that the mode is on (and when a trial ends) and what is coming.
    MODULES.study = function () {
      const info = (LumaPlan.addonInfo && LumaPlan.addonInfo.study) || {}, ends = info.expires_at ? new Date(info.expires_at) : null;
      const note = info.source === 'trial' && ends ? `Your free trial ends on ${ends.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ends ? `Active until ${ends.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}.` : '';
      return head('Study', 'Classes, assignments and group projects') + card(`<div class="ad-hero" style="--ac:#34d399;margin:0"><span class="ai"><i class="fa-solid fa-graduation-cap"></i></span><div><div class="an">Study mode is on</div><div class="at">${note || 'Being built, step by step.'}</div></div></div>
        <div class="ls" style="margin:14px 0 8px">What is coming here:</div><ul class="ad-perks" style="--ac:#34d399"><li><i class="fa-solid fa-check"></i><span>Weekly timetable</span></li><li><i class="fa-solid fa-check"></i><span>Assignments, tests and exams with reminders</span></li><li><i class="fa-solid fa-check"></i><span>Group projects with classmates</span></li><li><i class="fa-solid fa-check"></i><span>Grades and a semester planner</span></li></ul>`);
    };
