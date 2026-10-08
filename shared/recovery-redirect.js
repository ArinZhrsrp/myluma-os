// A password-reset link that lands on the wrong page is sent on to the reset page, keeping its tokens.
if (/type=recovery/.test(location.hash)) location.replace("/reset-password/" + location.hash);
