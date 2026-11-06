# Challenge Brief — Stop Before It Starts: Plug-and-Play Prevention for Platforms

> **Full PDF:** [`UNICRI Challenge Brief HFG#8.pdf`](UNICRI%20Challenge%20Brief%20HFG%238.pdf)

| | |
|---|---|
| **Project** | Hackathon for Good #8 |
| **Theme** | Child protection online |
| **Challenge owner** | UNICRI Centre for AI and Robotics and the UAE Ministry of Interior |
| **Initiative** | AI for Safer Children |
| **On site** | Emma Persson, UNICRI |
| **Contact** | info@hackathonforgood.org |
| **Date** | 6-8 November 2026 |
| **Location** | The Hague Tech, Den Haag |

---

## Background

UNICRI, the United Nations Interregional Crime and Justice Research Institute, runs the AI for Safer Children initiative together with the UAE Ministry of Interior from its Centre for AI and Robotics in The Hague. Most child protection technology works after abuse has happened: finding material, identifying victims, supporting investigations. This challenge works one step earlier, at the moment someone goes looking for child sexual abuse material (CSAM) online. Reaching them at that moment can stop the search, and it can point people who want to stop towards help.

Where it is tried, it helps. Warning messages already run on some large platforms, and help services exist in the Netherlands, but very few platforms show a warning and very few people who see one go on to seek help. The evidence is summarised in the [Evidence and Context](#evidence-and-context) section below.

This is the context UNICRI offers you as a team during Hackathon for Good #8.

---

## Problem Statement

**Warnings and help exist, but they reach too few people on too few platforms.**

UNICRI wants to close that gap, but today:

- Most platforms show no warning at all. The large platforms that do set theirs up one by one, often together with a specialist charity.
- Smaller and mid-sized platforms (forums, gaming chats, adult sites, hosting services) have no easy, cheap or ready-made solution.
- Even where warnings run, only about 1 in 100 people click through to help.
- Nobody yet knows which message, format and timing works best for which group of people, so there is room for new ideas.
- Help services exist in the Netherlands, but people rarely find them at the moment it matters.
- Fear of being reported keeps people from seeking help. The rules on confidentiality differ by country, and people need to know honestly what applies to them.

**Within this broad problem, the challenge focuses on the platforms: giving them something they can switch on.**

---

## The Challenge

> How can we give platforms in the Netherlands a **plug-and-play prevention package** that warns people looking for child sexual abuse material and guides them to help, which a small team can switch on in days rather than months, **ready to scale to other countries and languages**?

*An example of where the package should work: a Dutch hobby forum with 20,000 members and one part-time moderator, who wants a warning and a route to help live within a week.*

---

## Three Building Blocks, One Package

Your solution packages three building blocks into one product. The message and the route to help come with a starting point, so you can spend most of your time on the plug-and-play build. The creative space is in the package: a pop-up, an interstitial page, a chatbot, or a format nobody has tried yet. Strong solutions combine a solid technical build with a user experience that is easy to click through, both for the person who needs help and for the platform that has to implement it.

### 1. The Message (starting point provided)

Start from the Dutch legal consequences. Since 1 July 2024, child sexual abuse material falls under article 252 of the Dutch Criminal Code: up to six years in prison, or up to nine years when done habitually or professionally, and viewing material online is covered too. Research points in two directions: a deterrent message about legal consequences performed best at stopping people from entering a site in a randomised trial (Prichard et al. 2024), while a harm-focused message produced the most clicks to help in a large dark web field experiment on Ahmia.fi (Ciardha et al. 2026). Combine the legal message with a clear route to help and design for testing variants.

Legal source: [Openbaar Ministerie, Aanwijzing kinderpornografie](https://www.om.nl/onderwerpen/beleidsregels/aanwijzingen/jeugd---gezin---zeden/aanwijzing-kinderpornografie-2024a006).

### 2. The Route to Help (overview provided)

You do not need to research the help landscape: the existing Dutch and global options are listed under [Resources and Inspiration](#resources-and-inspiration). Roughly 1 in 100 people who see a warning click through to help, so this jump is where most people drop off. Your package routes people to the Dutch services, explains honestly what is confidential, and hands over to human professionals rather than replacing them.

### 3. Plug-and-Play for Platforms (the core build)

A lightweight, open module a platform can drop into its existing workflow: how the warning is triggered, which format it takes, how routing works per country and language, and how the platform measures impact without tracking individuals. Focus on making adoption cheap, easy and compelling, not on building new detection. Show the message in English and eventually in the language of the user's device or browser, and design so that the legal message and help services can be swapped per country, for roll-out across the EU and beyond.

---

## Guiding Questions

Use these as a compass, not a checklist:

- What would a trust and safety lead at a small platform need to say yes to installing this tomorrow?
- Which format interrupts the moment best: a full-page warning, a pop-up, a chatbot, or something else?
- How do you make the jump from warning to help one click, and keep it anonymous?
- How does the package show the right legal message, language and help service for each country?
- How can a platform know the warning works without collecting data on the people who see it, and how do you avoid habituation when someone sees it for the fifth time?

---

## Who You Are Helping

You are building for platforms, but you are designing for two users: the platform that switches it on, and the person who sees the warning.

### The Platform

The person who decides whether to install your package, at a small or mid-sized platform in the Netherlands. Typical profiles:

- a trust and safety lead at a forum or community platform;
- a developer at a gaming chat or community server;
- the operator of an adult site;
- a hosting or file-sharing service;
- a moderator team at a social or dating app.

They know they should do something, have little time and budget, cannot build their own system, and worry about privacy law and their users' trust.

### The Four Profiles

The four profiles below describe the person at the other end, from tempted to in deep, plus the people around them. They are composites based on the stages used in prevention research, not real individuals.

#### 01 — Tempted (has not acted)

Has sexual thoughts about children but has never searched for abuse material. Feels drawn to it, worries about it, often carries shame and has nobody to talk to.

**What might move them:** Knowing they are not alone, that the feelings are not their fault, that help is anonymous, and that acting is a choice.

*Reached via search engines, adult sites, forums, gaming and social platforms, health sites and general campaigns.*

#### 02 — Starting (first searches or views)

Has started searching for or viewing abuse material, or has had a first sexualised chat with a minor. May tell themselves it is harmless.

**What might move them:** A clear message that it is a crime, that children are harmed and that they can still stop, with one concrete next step.

*Reached via search results, adult platforms, gaming platforms, chat and social apps.*

#### 03 — In Deep (repeated viewing, sharing or contact)

Views or shares material repeatedly, or has had contact with children. Many say they want to stop, but most never receive help.

**What might move them:** Consequences that are real, help that exists even now, and treatment that works.

*Reached via the platforms where the behaviour happens, and after detection or arrest.*

#### 04 — People Around Them (partners, family, friends, professionals)

Worried about someone close to them, or about a client or patient, and unsure how to raise it.

**What might move them:** How to start the conversation, and where to refer.

*Reached via the Offlimits prevention line, GPs, schools and employers.*

---

## Sustainable Development Goals

- **SDG 16** Peace, Justice and Strong Institutions (target 16.2: end abuse, exploitation and all forms of violence against children)
- **SDG 3** Good Health and Well-being
- **SDG 17** Partnerships for the Goals

---

## Criteria

*Beneficial if feasible.*

- **Must:** be easy for a small platform to switch on, combine a clear warning with a route to Dutch or global help services, and protect the privacy of the people who see it.
- **Should:** be honest about legal consequences and about what is confidential, work in Dutch and English, and be accessible (plain language, screen readers, contrast).
- **Should not:** identify, track or expose individuals, or replace human professionals.
- **Could:** support other countries and languages, rotate and test message variants, and give platforms a simple impact dashboard.
- **Can have:** AI behind the scenes, for example to adapt or translate the message, as long as the experience stays clear and safe.

---

## Starter Kit and Safety

There is no dataset for this challenge, and you do not need one. The challenge GitHub repository is your starter kit:

- A mock platform you can run locally and plug your module into
- A plug-in contract that defines what the platform passes in and what your module returns
- A directory of Dutch and international help services
- Message building blocks in Dutch and English with their sources
- A synthetic traffic generator to demo impact without real users
- A sheet on legal consequences and confidentiality per country
- Templates for your submission

**Never search for, open, download or share child sexual abuse material, and never type abuse-related search terms into real platforms to test a warning.** In the Netherlands, even receiving such material can be a criminal offence (NOS, 2018). Use mock environments only.

---

## Safety Rules

### 1. Non-negotiable, briefed at kickoff

During the hackathon:

- **No real people:** no contact with real at-risk people or real children, no user testing on live platforms, no posting in perpetrator forums, no decoy profiles.
- **No vigilante tooling:** nothing that identifies, exposes or tracks individuals.
- **No public trigger lists:** publishing exactly what triggers a warning can teach people to avoid it, so keep term lists and detection rules out of public repositories.
- **Look after yourself:** this topic is heavy, and you can step away at any time.

See [SAFETY.md](SAFETY.md) for the full safety rules enforced in this repository.

---

## Evidence and Context

**Warning page plus reThink chatbot, Pornhub UK (2022-2023):** shown 2.8 million times, with a statistically significant drop in abuse-related searches; in 82% of sessions the person did not search again; 490 click-throughs and about 68 calls or chats to Stop It Now. Source: [University of Tasmania evaluation](https://figshare.utas.edu.au/articles/report/reThink_Chatbot_Evaluation/25320859)

**Project Intercept (Lucy Faithfull Foundation):** more than 70 million warnings on Google, TikTok, Meta, ChatGPT, Mega and adult sites in two years, across 22 interventions (reported May 2026), with about 683,000 click-throughs to help, roughly 1 in 100. Source: [Lucy Faithfull Foundation data](https://nominet.uk/news/more-than-70-million-attempts-to-access-child-sexual-abuse-imagery-intercepted-via-warning-messages-charity-reveals/)

**Redesigned search warning, Google Search:** new messaging cut follow-up abuse-related searches in the same session by 3.8 percentage points versus the old message (preprint, June 2026). Source: [Google Search preprint](https://arxiv.org/abs/2606.06126)

**Randomised warning trial, honeypot site, men aged 18 to 30:** three in four of the control group entered, against 35% to 47% after a warning. Deterrent and therapeutic messages both worked; adding images did not help. Source: [Prichard et al. 2024 trial](https://researchcommons.waikato.ac.nz/items/e5453eac-e5e2-4a0a-b60d-056f24f799bd)

**Warning messages on the Ahmia.fi dark web search engine (2025):** over 3 million searches triggered a warning, and redesigned messages raised click-through to help from 8.7% to 15.7%; a harm-focused message worked best. Source: Protect Children, [Preventive Pathways report](https://www.suojellaanlapsia.fi/en/post/preventive-pathways-csam-warnings-research-report)

**Anonymous self-help, ReDirection (Finland):** about half of more than 17,000 survey respondents say they want to stop; only 3% report having received help. Source: Protect Children, ReDirection programme. Two follow-up studies by the same team look at which CSAM users go on to contact children (Insoll et al. 2022) and what makes people seek help (Insoll et al. 2024); both are listed under [Resources and Inspiration](#resources-and-inspiration).

**Anonymous online cognitive behavioural therapy, Prevent It (Karolinska Institutet):** three randomised, controlled trials have found that Prevent It has significant positive effects both on actual offending behaviour towards children as well as on risk factors for future abuse. Source: [Karolinska Institutet](https://news.ki.se/reduced-use-of-child-sexual-abuse-material-after-online-cbt)

**Watch out: confidentiality.** Fear of being reported keeps people from seeking help, and the rules differ by country. Anonymous prevention lines in the Netherlands and Flanders are built on confidentiality, and Germany's Dunkelfeld programme relies on medical confidentiality under section 203 of the German Penal Code (Journal of Prevention, 2025). England is moving the other way: the Crime and Policing Act 2026 created a reporting duty for people in regulated activity with children, with guidance still to come (NSPCC). Your package must tell people honestly what is and is not confidential where they live.

**Vigilantism backfires.** In 2020, Dutch "pedojager" groups lured men into meetings and filmed or assaulted them; police counted around 250 violent incidents in a few months (Hart van Nederland). Reclassering Nederland warns that exposing and isolating people raises the risk of abuse rather than lowering it (NOS, 2020). Vigilantism signals a lack of better options; this challenge is about building one, based on evidence.

**Keep in mind:** many perpetrators were once victims, though most victims never offend. A meta-analysis found that people convicted of sexual offences, especially against children, report childhood sexual abuse more often than people convicted of other offences (Jespersen, Lalumiere and Seto, 2009). That supports prevention rooted in empathy and help. Abuse is never inevitable for survivors.

---

## What You Deliver

At the end of the hackathon, each team delivers on Junction:

- A working prototype or demo.
- A 3-minute pitch for the jury.
- A repository link and a short description: what you built, how it works, and why.

---

## Follow-Up Opportunity

The outcomes of this challenge will be shared on the AI for Safer Children Global Hub, the UNICRI platform used by law enforcement in more than 130 countries.

Irakli Beridze, Head of the UNICRI Centre for AI and Robotics, joins the final pitches in person on Sunday 8 November, and the UAE Ministry of Interior gives opening remarks online.

---

## Resources and Inspiration

- **UNICRI on site.** Emma Persson, Associate Programme Officer at the UNICRI Centre for AI and Robotics, is at the hackathon to answer questions and give feedback.
- **Expert mentors online.** Dr Christoffer Rahm (Karolinska Institutet, Sweden), who leads the Prevent It research on anonymous online therapy, and Dr Juha Nurmi (Tampere University, Finland), who built the Ahmia search engine and researches warning messages on the dark web. They host an online Q&A for all teams, you can find the times on discord.
- **Dutch help services.** [Preventielijn van Offlimits](https://preventielijn.offlimits.nl) (formerly Stop it Now Nederland): anonymous, free phone and chat, 0800 266 64 36, plus a peer group and conversation guides for partners and family. [Stoppen is mogelijk](https://stoppen-is-mogelijk.eu): anonymous self-help module for people worried about their viewing.
- **International help services.** Protect Children is a centralized platform that gathers regional and international resources and helplines in one place, such as:
  - **ReDirection** — An online self-help programme designed to help you live a life free from Child Sexual Abuse Material (CSAM). This programme uses a holistic approach and cognitive behavioural therapy to support consistent behavioural change.
  - **Shore** — Provides a safe, anonymous space for teenagers concerned about their own or others' sexual thoughts or behaviour. Shore offers expert advice and support to help manage these concerns and learn to live safely online and offline.
  - **Stop It Now! UK & Ireland** — A confidential helpline and self-help resource for anyone concerned about their thoughts or behaviours towards children. This service provides support and practical steps to help you move forward positively.
  - **Help Wanted** — An online course aimed at helping individuals understand and control their attraction to children.
  - **Troubled Desire** — An online service providing confidential resources and local therapist referrals for individuals concerned about their sexual feelings towards children and early adolescents (in English, French, German, Hindi, Marathi, Portuguese, and Spanish).
  - **Helplinks.eu** — A directory of international and local resources and helplines for those seeking support regarding sexual thoughts or behaviours towards children.
  - **Moore Center** — A collection of resources for those concerned about their sexual thoughts or behaviours.
- University of Tasmania: [reThink Chatbot evaluation on Pornhub UK](https://figshare.utas.edu.au/articles/report/reThink_Chatbot_Evaluation/25320859) (2024)
- Prichard et al.: [The effect of therapeutic and deterrent messages](https://researchcommons.waikato.ac.nz/items/e5453eac-e5e2-4a0a-b60d-056f24f799bd), Child Abuse and Neglect (2024)
- Karolinska Institutet: [Prevent It trial results](https://news.ki.se/reduced-use-of-child-sexual-abuse-material-after-online-cbt), Internet Interventions (2022)
- Protect Children: [Online Warning Messages for CSAM Prevention](https://www.suojellaanlapsia.fi/en/post/preventive-pathways-csam-warnings-research-report), Evidence and Practice Mapping Report (2025)
- Protect Children: Preventive Pathways, [how warning messages interrupt and prevent online child sexual abuse at scale](https://www.suojellaanlapsia.fi/en/post/preventive-pathways-csam-warnings-research-report) (June 2026)
- Google Search: [Deterring searches for CSAM and promoting help-seeking](https://arxiv.org/abs/2606.06126) (preprint, 2026)
- Lucy Faithfull Foundation: [Project Intercept](https://nominet.uk/news/more-than-70-million-attempts-to-access-child-sexual-abuse-imagery-intercepted-via-warning-messages-charity-reveals/), and Lessons from seven years of deterrence campaigning
- ***Tip: for designing the route to help, start with Insoll et al. (2022 and 2024) and Lahtinen et al. (2025) in the research papers below.***
- Internet Watch Foundation: How AI is being abused to create child sexual abuse imagery
- For scaling beyond the Netherlands: [Stop It Now UK and Ireland](https://www.stopitnow.org.uk) (Lucy Faithfull Foundation), helpline 0808 1000 900
- [ReDirection (Protect Children, Finland)](https://www.suojellaanlapsia.fi/en/redirection), a multilingual anonymous self-help programme
- [Kein Täter werden / Dunkelfeld (Germany)](https://www.kein-taeter-werden.de/), free confidential therapy

### Research Papers

- Insoll, Tegan, Anna Katariina Ovaska, Juha Nurmi, Mikko Aaltonen, and Nina Vaaranen-Valkonen. "Risk factors for child sexual abuse material users contacting children online: Results of an anonymous multilingual survey on the dark web." *The Journal of Online Trust and Safety* 1, no. 2 (2022). <https://doi.org/10.54501/jots.v1i2.29>
- Nurmi, Juha, Arttu Paju, Billy Bob Brumley, Tegan Insoll, Anna K. Ovaska, Valeriia Soloveva, Nina Vaaranen-Valkonen, Mikko Aaltonen, and David Arroyo. "Investigating child sexual abuse material availability, searches, and users on the anonymous Tor network for a public health intervention strategy." *Scientific Reports* 14, no. 1 (2024): 7849. <https://www.nature.com/articles/s41598-024-58346-7>
- Insoll, Tegan, Valeriia Soloveva, Eva Diaz Bethencourt, Anna Katariina Ovaska, Juha Nurmi, Arttu Paju, Mikko Aaltonen, and Nina Vaaranen-Valkonen. "Factors associated with help-seeking among online child sexual abuse material offenders: Results of an anonymous survey on the dark web." *Journal of Online Trust and Safety* 2, no. 4 (2024). <https://doi.org/10.54501/jots.v2i4.205>
- Lahtinen, Hanna-Mari, Kirsi Honkalampi, Tegan Insoll, Juha Nurmi, Ethel Quayle, Anna Katariina Ovaska, and Nina Vaaranen-Valkonen. "Investigating the disparities among child sexual abuse material users: Anonymous self-reports from both charged and uncharged individuals." *Child Abuse & Neglect* 161 (2025): 107299. <https://doi.org/10.1016/j.chiabu.2025.107299>
- Ciardha, Caoilte O., Joel Scanlan, Tegan Insoll, Juha Nurmi, and Nina Vaaranen-Valkonen. "Warning Message Content Increases Help Seeking in a Large-Scale Dark Web CSAM Intervention." arXiv preprint arXiv:2606.06417 (2026). <https://doi.org/10.48550/arXiv.2606.06417>
- Protect Children: ["CSAM Perpetrator Research Report"](https://www.suojellaanlapsia.fi/en/post/tmat-csam-perpetrator-research-report), plus the launch event video

---

*This brief is a starting point, not a specification. Teams are free to reinterpret the problem within the criteria and safety rules above.*

*Challenge owners: UNICRI Centre for AI and Robotics and the UAE Ministry of Interior, AI for Safer Children*

*Questions about the hackathon: info@hackathonforgood.org*
