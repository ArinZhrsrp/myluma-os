// LUMA — core: calendar files (.ics) for Google, Apple and Outlook Calendar.
    // luIcs.build([{ uid, title, date, time, endDate, endTime, allDay, rrule, until, exdates, desc, loc, alarm }], 'Calendar name') → the file text
    //   date / endDate: 'YYYY-MM-DD' · time / endTime: 'HH:MM' (a time with no zone means "wherever you are", so it lands at the same clock time) ·
    //   rrule: 'FREQ=WEEKLY;BYDAY=MO' (without "RRULE:") · exdates: dates to skip · alarm: minutes before to remind
    // luIcs.download('name.ics', text) saves it.
    const luIcs = (() => {
      const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
      const d8 = k => k.replace(/-/g, '');
      const dt = (k, t) => d8(k) + 'T' + String(t || '00:00').slice(0, 5).replace(':', '') + '00';
      const nextDay = k => new Date(Date.parse(k + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
      const fold = line => { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); };
      const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
      function build(events, name) {
        const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LUMA//Personal OS//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name || 'LUMA')];
        events.forEach((e, i) => {
          if (!e.date || !e.title) return;
          L.push('BEGIN:VEVENT', 'UID:' + (e.uid || 'luma-' + i + '-' + d8(e.date)) + '@luma', 'DTSTAMP:' + stamp(), 'SUMMARY:' + esc(e.title));
          const allDay = e.allDay || !e.time;
          if (allDay) { L.push('DTSTART;VALUE=DATE:' + d8(e.date), 'DTEND;VALUE=DATE:' + d8(nextDay(e.endDate || e.date))); }
          else { L.push('DTSTART:' + dt(e.date, e.time), 'DTEND:' + dt(e.endDate || e.date, e.endTime && (e.endDate || e.endTime > e.time) ? e.endTime : e.time)); }
          if (e.rrule) L.push('RRULE:' + e.rrule + (e.until ? ';UNTIL=' + d8(e.until) + (allDay ? '' : 'T235959') : ''));
          (e.exdates || []).forEach(x => L.push(allDay ? 'EXDATE;VALUE=DATE:' + d8(x) : 'EXDATE:' + dt(x, e.time)));
          if (e.desc) L.push('DESCRIPTION:' + esc(e.desc));
          if (e.loc) L.push('LOCATION:' + esc(e.loc));
          if (e.alarm != null) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.title), 'TRIGGER:-PT' + Math.max(0, +e.alarm) + 'M', 'END:VALARM');
          L.push('END:VEVENT');
        });
        L.push('END:VCALENDAR');
        return L.map(fold).join('\r\n') + '\r\n';
      }
      function download(filename, text) {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
      }
      return { build, download, esc };
    })();
