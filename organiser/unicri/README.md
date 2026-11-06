# Stop Before It Starts

**Hackathon for Good #8** | 6-8 November 2026 | The Hague

**Challenge owner:** [UNICRI Centre for AI and Robotics](https://unicri.it/) and the UAE Ministry of Interior — [AI for Safer Children](https://aiforsaferchildren.com/) initiative.

---

## The Challenge

Most child protection technology works after abuse has happened. This challenge works one step earlier: at the moment someone goes looking for child sexual abuse material (CSAM) online. Warning messages already run on some large platforms, and help services exist in the Netherlands, but very few platforms show a warning and very few people who see one go on to seek help.

**Your challenge:** build a plug-and-play prevention package that platforms in the Netherlands can switch on in days rather than months — combining a warning message, a route to help, and easy integration — ready to scale to other countries and languages.

Think of the target: a Dutch hobby forum with 20,000 members and one part-time moderator, who wants a warning and a route to help live within a week. What would it take for them to say yes?

Read the [full challenge brief](BRIEF.md) or the [PDF version](UNICRI%20Challenge%20Brief%20HFG%238%20%7Bdraft%20v1.1%20_%203%20Nov%202026%7D.pdf).

---

## Quick Start

**Prerequisites:** Node.js 20+ and npm.

```bash
# 1. Clone the repo (or your fork)
git clone https://github.com/Hackathon-for-Good-The-Hague/HFG8-UNICRI-Stop-Before-It-Starts.git
cd HFG8-UNICRI-Stop-Before-It-Starts

# 2. Install dependencies
npm install

# 3. Run the safety check
npm run check

# 4. Start the mock platform and backend
npm run dev

# 5. Open the mock platform
#    http://localhost:3000/mock-platform/

# 6. Type "test-trigger-red" in the search bar to see the warning
```

That is all. You should see the mock platform with a search bar. Typing `test-trigger-red` triggers the warning flow. From here, build your solution.

---

## Repository Map

```
README.md                  You are here
BRIEF.md                   Full challenge brief in markdown
SAFETY.md                  Safety rules (read this first)
CONTRIBUTING.md            How to fork, branch and contribute
CODE_OF_CONDUCT.md         Contributor Covenant v2.1
CLAUDE.md                  Context for AI coding assistants
research/
  EVIDENCE.md              Evidence summaries with source links
  PERSONAS.md              User personas (4 profiles + platform)
  READING.md               Full reading list organised by topic
submission/
  TEAM_README_TEMPLATE.md  Template for your team's README
  ONE_PAGER_TEMPLATE.md    Template for rationale and safe test plan
  PITCH_GUIDE.md           3-minute pitch structure and jury criteria
data/
  help-services.json       Dutch and international help services
  legal-confidentiality.json  Legal info and confidentiality per country
  message-blocks.json      Warning message building blocks (NL + EN)
contract/
  PLUGIN_CONTRACT.md       Plug-in contract (what goes in, what comes out)
  schemas/                 JSON Schema files for all data types
mock-platform/             Mock platform to test your module against
starter-widget/            Starter code for the warning widget
starter-backend/           Starter Express backend
tools/                     Safety check, traffic generator, dashboard
test/                      Tests
integrations/              Example integrations (Discourse, WordPress)
```

---

## Safety Rules

This challenge deals with the prevention of CSAM. The safety rules are non-negotiable.

1. **No real abuse-related search terms** — only `test-trigger-*` placeholders
2. **No real people or user data** — everything is synthetic
3. **No tooling that identifies, exposes or tracks individuals**
4. **Aggregate measurement only** — counts suppressed below 10
5. **Do not invent facts** — verify or mark with `[VERIFY]`

Run `npm run check` before every commit. Read the full rules in [SAFETY.md](SAFETY.md).

---

## What You Deliver

| Deliverable | Description |
|-------------|-------------|
| **Working prototype** | Shown in the mock platform (embeddable module, chatbot, interstitial, or your own format) |
| **3-minute pitch** | Problem, demo, evidence, next steps — see [PITCH_GUIDE.md](submission/PITCH_GUIDE.md) |
| **One-pager** | Target user, platform, evidence, safe test plan — see [ONE_PAGER_TEMPLATE.md](submission/ONE_PAGER_TEMPLATE.md) |
| **Repository** | Your fork with a README explaining what you built and how to install it — see [TEAM_README_TEMPLATE.md](submission/TEAM_README_TEMPLATE.md) |

**Jury scoring:** Impact on prevention 25% | Adoptability 25% | Creativity 20% | Safety and ethics 20% | Clarity of pitch 10%

---

## Resources and Mentors

- **Emma Persson** (UNICRI, Associate Programme Officer) — on site at the hackathon
- **Dr Christoffer Rahm** (Karolinska Institutet, Sweden) — leads the Prevent It research on anonymous online therapy. Online Q&A — check Discord for times
- **Dr Juha Nurmi** (Tampere University, Finland) — built the Ahmia search engine, researches warning messages on the dark web. Online Q&A — check Discord for times

**Dutch help services:**
- Preventielijn van Offlimits: 0800 266 64 36 | <https://preventielijn.offlimits.nl>
- Stoppen is mogelijk: <https://stoppen-is-mogelijk.eu>

See the [full reading list](research/READING.md) and [evidence summaries](research/EVIDENCE.md) for all research links.

---

## Follow-Up

The outcomes of this challenge will be shared on the **AI for Safer Children Global Hub**, the UNICRI platform used by law enforcement from more than 120 countries. Irakli Beridze, Head of the UNICRI Centre for AI and Robotics, joins the final pitches in person on Sunday 8 November.

---

## License

[MIT](LICENSE)
