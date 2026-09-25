# Design decisions

The visual language of this console is a dark, hairline-bordered,
monospace-forward developer interface: a flat black canvas, layers separated by
1px borders rather than shadows, and a single violet accent reserved for code
and identifiers. `docs/tokens.css` holds the tokens; this file records the
decisions taken about how they are used, and why.

The reasoning matters more than the values. A token file tells you what the
colours are. It does not tell you that one of them fails a contrast check, or
that the accent is not allowed on a button.

---

## 0. The direction was chosen against alternatives

Four visual directions were drawn as the same screen — the user directory, same
data, same columns — and compared side by side rather than argued about:

| Direction | What it was | Why it was not chosen |
|---|---|---|
| **Void / hairline** | Flat black, hairline borders, ghost controls, one violet accent on identifiers | **Chosen** |
| Paper ledger | Light warm ground, serif display, rules instead of cards, oxblood accent | The most distinctive of the four, and the code windows the inspector depends on read as foreign objects on a light ground. The inspector is the thesis; a language that fights it is the wrong language. |
| Terminal | All monospace, no radii, 28px rows, status codes as a live log | Denser and more literally a console, but it has no unfilled control vocabulary, so the accent would have to become a fill. That trades away section 2 to gain atmosphere. |
| Blueprint | Ink navy ground, serif display, brass accent, panels lifted above the canvas | Warmer than the chosen direction and defensible, but the lifted panel undoes section 6 — elevation returns as a surface rather than a border. |

The comparison is recorded because the choice is otherwise invisible. A single
direction in a repository reads as the only thing that was tried.

The screen that decided it was the table, not the sign-in. Every direction looks
competent on a sign-in form; the difference appears at 134 rows.

## 1. Type is substituted deliberately

The reference language calls for three licensed typefaces. A public repository
cannot ship licensed fonts, and linking to a foundry CDN would make the console
depend on a third party for its first paint.

| Role | Family | Licence |
|---|---|---|
| Body, UI, navigation, buttons | **Inter** | OFL |
| Display, used only on the sign-in screen and empty states | **Playfair Display** | OFL |
| Code, identifiers, status labels, table metadata | **JetBrains Mono** | OFL |

Self-hosted through Fontsource, not a CDN: one less origin in the critical path,
no third-party request on first paint, and it works offline in development.

**The subset must include `latin-ext`.** The directory this console renders
contains names like `Jovanović` and `Petrović`. A `latin`-only subset drops
those glyphs and falls back mid-word, which looks like a bug and is one.

All three are installed as variable fonts. One file per subset covers the whole
weight axis, so a weight is a number rather than another download, and each
package declares every subset with its own `unicode-range` — `latin-ext` is
therefore fetched exactly when a glyph needs it and never otherwise. The
variable builds name their family with a `Variable` suffix (`Inter Variable`),
which is what `docs/tokens.css` asks for; the static name sits behind it in the
stack as a fallback.

## 2. Buttons are ghost, and the accent is not for buttons

Every button is transparent with a 1px `--color-graphite-hairline` border and
white text, 6px radius. Hover raises the border toward white. There is no
filled primary button anywhere.

- **Destructive** actions — locking a user — are ghost with an
  `--color-alarm-red` border and text. Never filled red.
- **`--color-signal-blue`** appears only as the selected state in navigation.
  It is not a button colour.
- **`--color-iris-violet`** belongs to code strings, email addresses and
  identifiers. It behaves like syntax highlighting, never like decoration, and
  never on a control.

This is the one place where the reference material contradicts itself: its
component notes describe an unfilled signature button, while its quick-reference
lists a filled blue primary action. The component notes are the more specific
description and they win. Consistency was chosen over the shortcut of having a
loud primary button.

## 3. Two colours are banned from text, and a test enforces it

Measured against the `#000000` canvas, with WCAG AA requiring 4.5:1 for body
text and 3:1 for large text and UI components:

| Token | Value | On black | Verdict |
|---|---|---|---|
| White | `#ffffff` | 21.00:1 | text |
| Bone White | `#f0f0f0` | 18.43:1 | text |
| Smoke Gray | `#abafb4` | 9.52:1 | text |
| Ash Gray | `#a1a4a5` | 8.37:1 | text |
| Iris Violet | `#9281f7` | 6.71:1 | text |
| Signal Blue | `#3b9eff` | 7.52:1 | text |
| Pulse Green | `#3ad389` | 10.86:1 | text |
| Amber | `#ffca16` | 13.71:1 | text |
| Alarm Red | `#ff9592` | 9.97:1 | text |
| Crimson | `#ff6465` | 7.26:1 | text |
| **Iron** | `#6e727a` | **4.35:1** | **large text and UI only — never body text** |
| **Charcoal** | `#464a4d` | **2.35:1** | **never text of any size** |
| Graphite Hairline | `#292d30` | 1.51:1 | borders only, by definition |

Two consequences:

**`Charcoal` is not a text colour.** The reference assigns it to inline code,
which at 2.35:1 would be unreadable for a large share of users and fails AA
outright. Inline code uses `--color-ash-gray` for punctuation and
`--color-iris-violet` for identifiers instead.

**`Iron` misses AA for body text by 0.15.** Close enough to look fine to
someone with good eyesight on a good screen, which is exactly why it needs a
rule rather than a judgement call. Permitted for disabled control text, where
the disabled state is also carried by the cursor and `aria-disabled`, and for
decorative rules. Not permitted for any text that carries information on its
own.

These ratios are asserted by a unit test over the approved pairs, not merely
written here. The same repository this console talks to spent two weeks with a
documented architecture rule that no test enforced; the lesson transferred.

## 4. One token set, two densities

This is a marketing-site visual language applied to a data-dense application,
and the mismatch is real: 96px section gaps, 32px card padding and a 1200px
maximum width are correct for a landing page and wrong for a table of users.

Rather than pick one, the tokens carry two densities.

| | Editorial | Application |
|---|---|---|
| Where | Sign-in screen, empty states, the 404 | App shell, directory, detail, inspector |
| Display type | 56 / 77 / 96px, negative tracking | Never |
| Body | 16 / 18px | 12 / 14px |
| Spacing | 32 / 48 / 96px | 8 / 12 / 16px |
| Width | 1200px, centred | Full width |
| Table row | — | 40px |

The sequence is intentional: a visitor meets a confident editorial sign-in
screen, then enters a dense console. The same tokens produce both; only their
selection changes.

## 5. Status colour maps to HTTP, and nowhere else

The reference reserves its chromatic accents for data and status, never for
chrome. Here, status means one thing — the class of an HTTP response — and the
mapping is fixed so a reader learns it once:

| Class | Token | Value |
|---|---|---|
| 2xx | `--color-pulse-green` | `#3ad389` |
| 3xx | `--color-sky-blue` | `#70b8ff` |
| 4xx | `--color-amber` | `#ffca16` |
| 5xx | `--color-crimson` | `#ff6465` |
| pending | `--color-ash-gray` | `#a1a4a5` |

Colour never carries the meaning alone. Every status dot is paired with its
numeric code in `JetBrains Mono`, so the information survives both colour
blindness and a monochrome screen.

## 6. Elevation is a border

No drop shadows. Layers are separated by 1px `--color-graphite-hairline` against
flat black, exactly as the reference specifies. `--surface-surface-lift`
(`#0b0e14`) is used only for modal and panel backgrounds, where a scrim needs to
read as above the canvas.

Radii are two values and never mixed on one surface: **6px** for buttons,
inputs and badges; **16px** for cards and code windows. Large panels may use
24px.

## 7. Component mapping

How the reference's components become this console's parts.

| Reference component | Becomes |
|---|---|
| Code Block / Terminal Window | The request and response panes in the inspector |
| Status Indicator Dot | HTTP status class on every captured request |
| Email Address Badge | The email column in the directory, violet on black |
| Section Card | Detail panels, the sign-in card, empty states |
| Hero Announcement Pill | The API version and environment badge in the shell |
| Icon Container | The only chromatic surface: the app mark in the shell |
| Primary Button (ghost) | Every action in the application |

The inspector is the reason this visual language was chosen rather than
decorated onto the app. Its terminal window, its status dots and its
monospace-violet identifiers were already the reference's own vocabulary; the
feature is styled by the design rather than fitted into it.

## 8. Motion

150ms ease-out on hover and focus transitions. Fade-and-slide on the sign-in
screen only. Nothing animates in the directory or the inspector — a table that
moves while you read it is worse than a table that does not.

All of it behind `prefers-reduced-motion: reduce`, which removes transitions
rather than shortening them.

## 9. What is deliberately absent

- No gradients, glows or chromatic washes on any background. The canvas is flat
  black.
- No coloured card fills. Cards sit on black with a hairline border.
- No third accent hue in the chrome. Monochrome plus one violet; the status
  colours belong to data.
- No WebGL. The reference anchors its hero with a rendered 3D object; a console
  behind a login has nothing to anchor, and the payload would buy nothing.
- No light theme. Not a limitation to apologise for — the language is
  black-canvas by construction, and a light variant would be a different design
  rather than a toggle.

## 10. Entity status is not HTTP status

Section 5 reserves the chromatic palette for the class of an HTTP response. It
does not say what a user's own status then looks like, and without that rule the
obvious thing happens: green for Active, amber for Pending, red for Locked. Then
green means two different things on one screen, and the mapping a reader was
supposed to learn once has to be learned twice.

So entity status is rendered without colour:

| Status | Renders as |
|---|---|
| Active | `Active`, bone white, 14px sans |
| Pending | `Pending`, ash gray, 14px sans |
| Locked | A padlock glyph plus `Locked`, ash gray |
| Deactivated | A struck-circle glyph plus `Deactivated`, ash gray |

The difference between Active and Pending is weight and value, not hue. Locked
and Deactivated carry glyphs because they are the states with consequences and
the ones worth finding while scanning a column; the two glyphs differ so that
the two are never confused in a column of forty rows. These four are exactly the
values the API accepts.

The same rule governs role badges: a hairline border and ash gray text, never a
colour per role. Roles are user-defined data in the API's seed, and a palette
that has to grow when a role is added is not a palette.

Enforced rather than written: the status tokens are restricted to
`src/ui/StatusDot.tsx` and the inspector's response-rendering modules, so a
status colour cannot reach a directory cell by hand. The primitive is on that
list because the mapping has to live somewhere and one file is a narrower
allowance than a whole feature folder; every other component is handed a
`StatusDot`, never a colour.

## 11. Tokens have two tiers, and components may only touch the second

`docs/tokens.css` is not a list of colours. It is two layers, and the split is
the reason every rule above is enforceable.

**Tier 1 is primitives**, named by what they are: `--color-iris-violet`,
`--color-graphite-hairline`, `--color-iron`. They carry the values and nothing
else. No component references them.

**Tier 2 is semantics**, named by the job: `--color-fg-identifier`,
`--color-border-default`, `--color-fg-disabled`, `--color-status-4xx`. These are
what components use.

The reason is not tidiness. A name like `--color-graphite-hairline` tells a
reader what the colour looks like and nothing about where it is allowed;
`--color-border-default` cannot be put on text without the mistake being
obvious in the diff. The rules in sections 2, 3, 5 and 10 are about *where* a
colour may appear, so the tokens have to be named by place. `Iron` becoming
`--color-fg-disabled` and `--color-border-rule` is the whole of section 3
expressed as two names: there is no semantic token that makes `Iron` available
for body text, and no semantic token for `Charcoal` at all.

**A component that needs a colour not named in tier 2 needs a decision, not a
hex value.** That is the rule the review applies — a new tier 2 token is a small
amendment to this document, and a raw primitive in a component is a defect.

**Values live in CSS, permissions live in TypeScript.** `docs/tokens.css` holds
the numbers so Tailwind can generate utilities from them.
`src/lib/design/tokens.ts` holds the sets the rules are made of — which tokens
may carry body text, which may carry large text, which are borders only, and
which surface each is measured against. `src/lib/design/contrast.test.ts`
asserts the section 3 table over those sets, which is why adding `Charcoal` to
the text set fails the build rather than passing review.

**Density is selected, not computed.** Both scales exist as distinct tokens —
`--text-editorial-lg` and `--text-app-body` are different names, not one name
with two values — because a screen belongs to one density for its whole life
and a media query would make it change mid-session. Generic primitives that must
work in both read `--density-body`, `--density-gap` and `--density-pad`, which
resolve from a `data-density` attribute on the screen's root. Application
density is the default; editorial is declared. There are exactly three screens
that declare it: sign-in, the 404, and empty states rendered at full height.
