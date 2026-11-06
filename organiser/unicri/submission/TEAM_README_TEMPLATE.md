# Team README Template

_Replace this header and fill in each section. Delete the instructions in italics before submitting._

---

## Team Name

_Your team name._

## What We Built

_One or two paragraphs. What does the prototype do? Which of the three building blocks (message, route to help, plug-and-play) did you focus on? Which persona stage (01-04) does it target? What is your creative angle?_

## How to Run It

_Step-by-step instructions to run your prototype locally._

```bash
# Example:
git clone <your-fork-url>
cd HFG8-UNICRI-Stop-Before-It-Starts
npm install
npm run dev
# Open http://localhost:3000/mock-platform/
# Type "test-trigger-red" in the search bar to see the warning
```

_List any prerequisites (Node version, browser, etc.)._

## How a Platform Installs It

_Explain what a platform operator needs to do to add your module to their site. Be specific: which file do they include? What configuration do they set? How long does it take?_

```html
<!-- Example: -->
<script src="https://your-cdn/sbis-widget.js"></script>
<script>
  SBIS.init({ country: "NL", lang: "nl" });
</script>
```

## How to Test Impact Safely

_Describe how UNICRI, a platform or a research partner could measure whether your solution works — without exposing anyone to harm. Reference the safety rules in [SAFETY.md](../SAFETY.md)._

_Key constraints:_
- _No tracking of individuals_
- _Aggregate metrics only (counts suppressed below 10)_
- _No real abuse-related search terms — only `test-trigger-*` terms_
- _No live testing on real platforms during the hackathon_

## What We Would Do Next

_If you had three more months, what would you build? Consider: more countries/languages, A/B testing framework, platform partnerships, accessibility improvements, research collaborations._

## Team Members

| Name | Role | Contact |
|------|------|---------|
| _Name_ | _Role_ | _Optional_ |
| _Name_ | _Role_ | _Optional_ |
| _Name_ | _Role_ | _Optional_ |
| _Name_ | _Role_ | _Optional_ |
