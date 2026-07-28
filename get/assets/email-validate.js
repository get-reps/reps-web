/**
 * REPS funnel email validation — structural checks + typo suggestion.
 *
 * Why this exists: the funnel's original check was /^[^\s@]+@[^\s@]+\.[^\s@]+$/, which
 * accepts "x@gmial.com", "x@yahoo.con" and "x@hotmail" (no TLD). Every hard bounce costs
 * sender reputation shared across ALL signups, and on 2026-07-28 the external bounce rate
 * was 2.14% — at Google/Yahoo's bulk-sender danger threshold.
 *
 * Scope, honestly: this catches TYPOS and malformed addresses. It cannot catch a
 * well-formed address whose mailbox does not exist (e.g. the 2026-07-27 signup
 * jerrygolebaki@gmail.com, a Permanent/General hard bounce). That needs a mailbox
 * verification API at submit time; deliberately not added here.
 *
 * The domain list is ordered by REAL observed signup volume from Resend, not by the
 * usual dev-centric assumptions. This funnel skews consumer/older: Yahoo, AOL and
 * Hotmail together outweigh Gmail.
 *
 * Exposes: window.repsValidateEmail(raw) -> { ok, reason, suggestion }
 *   ok:         true when safe to submit as-is
 *   reason:     user-facing message when ok === false and there is no suggestion
 *   suggestion: a corrected address to OFFER (never auto-apply — see below)
 *
 * UX contract: a suggestion is an offer, not a block. Auto-correcting a user's address
 * is how you silently send to the wrong person. Offer it, let them tap it.
 */
(function (root) {
  "use strict";

  // Ordered by observed signup volume in the live funnel.
  var COMMON_DOMAINS = [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "hotmail.com",
    "aol.com",
    "icloud.com",
    "hotmail.co.uk",
    "yahoo.co.uk",
    "live.co.uk",
    "mac.com",
    "me.com",
    "googlemail.com",
    "yahoo.ie",
    "msn.com",
    "comcast.net",
    "sbcglobal.net",
    "verizon.net",
    "btinternet.com",
    "sky.com",
    "protonmail.com",
    "proton.me",
  ];

  // TLD typos that are unambiguous enough to suggest on their own.
  var TLD_FIXES = {
    con: "com",
    cmo: "com",
    ocm: "com",
    xom: "com",
    vom: "com",
    comm: "com",
    co: "com", // only applied when the base domain matches a known provider
    cm: "com",
    om: "com",
    nte: "net",
    ner: "net",
    orgg: "org",
  };

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1);
    var i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) {
        cur[j] = Math.min(
          prev[j] + 1,
          cur[j - 1] + 1,
          prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1)
        );
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function suggestDomain(domain) {
    if (!domain) return null;
    if (COMMON_DOMAINS.indexOf(domain) !== -1) return null; // already exact

    // 1. TLD-only typo, keeping a known base (gmail.con -> gmail.com)
    var lastDot = domain.lastIndexOf(".");
    if (lastDot > 0) {
      var base = domain.slice(0, lastDot);
      var tld = domain.slice(lastDot + 1);
      if (Object.prototype.hasOwnProperty.call(TLD_FIXES, tld)) {
        var fixed = base + "." + TLD_FIXES[tld];
        if (COMMON_DOMAINS.indexOf(fixed) !== -1) return fixed;
      }
    }

    // 2. Whole-domain near-miss. Threshold scales with length so short domains
    //    (aol.com) do not collect false positives from unrelated real domains.
    var best = null;
    var bestDist = Infinity;
    for (var i = 0; i < COMMON_DOMAINS.length; i++) {
      var cand = COMMON_DOMAINS[i];
      var d = levenshtein(domain, cand);
      if (d < bestDist) {
        bestDist = d;
        best = cand;
      }
    }
    var limit = domain.length <= 8 ? 1 : 2;
    return bestDist > 0 && bestDist <= limit ? best : null;
  }

  function validate(raw) {
    var email = String(raw == null ? "" : raw).trim();

    if (!email) return { ok: false, reason: "Please enter your email address.", suggestion: null };

    // Strip a stray mailto: prefix and surrounding angle brackets before judging.
    email = email.replace(/^mailto:/i, "").replace(/^<|>$/g, "").trim();

    if (/\s/.test(email)) {
      return { ok: false, reason: "Email addresses cannot contain spaces.", suggestion: null };
    }

    var at = email.lastIndexOf("@");
    if (at < 1 || at === email.length - 1) {
      return { ok: false, reason: "Please enter a valid email address.", suggestion: null };
    }
    if (email.indexOf("@") !== at) {
      return { ok: false, reason: "That address has more than one @ sign.", suggestion: null };
    }

    var local = email.slice(0, at);
    var domain = email.slice(at + 1).toLowerCase();

    if (local.length > 64 || email.length > 254) {
      return { ok: false, reason: "That email address is too long.", suggestion: null };
    }
    if (/^\.|\.$|\.\./.test(local)) {
      return { ok: false, reason: "Please enter a valid email address.", suggestion: null };
    }
    // Deliberately permissive on the local part (plus-addressing, apostrophes, etc.)
    if (/[(),:;<>\[\]\\"]/.test(local)) {
      return { ok: false, reason: "Please enter a valid email address.", suggestion: null };
    }

    if (domain.indexOf(".") === -1) {
      return { ok: false, reason: "That email address is missing a domain, like .com.", suggestion: null };
    }
    if (/^[.-]|[.-]$|\.\.|-\.|\.-/.test(domain)) {
      return { ok: false, reason: "Please enter a valid email address.", suggestion: null };
    }
    if (!/^[a-z0-9.-]+$/.test(domain)) {
      return { ok: false, reason: "Please enter a valid email address.", suggestion: null };
    }
    var tld = domain.slice(domain.lastIndexOf(".") + 1);
    if (tld.length < 2 || /[^a-z]/.test(tld)) {
      return { ok: false, reason: "Please check the end of that address, like .com.", suggestion: null };
    }

    var better = suggestDomain(domain);
    if (better) {
      return { ok: false, reason: null, suggestion: local + "@" + better };
    }

    return { ok: true, reason: null, suggestion: null, normalized: local + "@" + domain };
  }

  root.repsValidateEmail = validate;

  // Test hook — harmless in the browser, lets the node suite import the same logic.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { repsValidateEmail: validate, suggestDomain: suggestDomain };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
