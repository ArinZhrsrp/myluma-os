// LUMA — module: work
    // The Work add-on's home. Placeholder for now: shows that the mode is on (and when a trial ends) and what is coming.
    MODULES.work = function () {
      const info = (LumaPlan.addonInfo && LumaPlan.addonInfo.work) || {}, ends = info.expires_at ? new Date(info.expires_at) : null;
      const note = info.source === 'trial' && ends ? `Your free trial ends on ${new Date(ends - 1000).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ends ? `Active until ${new Date(ends - 1000).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}.` : '';
      return head('Work', 'Projects, tasks and teams') + card(`<div class="ad-hero" style="--ac:#60a5fa;margin:0"><span class="ai"><i class="fa-solid fa-briefcase"></i></span><div><div class="an">Work mode is on</div><div class="at">${note || 'Being built, step by step.'}</div></div></div>
        <div class="ls" style="margin:14px 0 8px">What is coming here:</div><ul class="ad-perks" style="--ac:#60a5fa"><li><i class="fa-solid fa-check"></i><span>Projects and tasks with assignees, due dates and status</span></li><li><i class="fa-solid fa-check"></i><span>Board and timeline views</span></li><li><i class="fa-solid fa-check"></i><span>Comments and files on tasks</span></li><li><i class="fa-solid fa-check"></i><span>Time tracking and a monthly timesheet</span></li></ul>`);
    };
