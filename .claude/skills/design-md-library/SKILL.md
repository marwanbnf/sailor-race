---
name: design-md-library
description: Library of 84 ready-made DESIGN.md design systems (colors, typography, spacing, components, rules) inspired by real sites such as Stripe, Linear, Apple, Vercel, Notion, Airbnb, Spotify, Tesla and more. Use when the user asks for a UI that "looks like" or is "inspired by" a known site or brand, wants to pick a visual style or design system, or asks to add a DESIGN.md to the project.
license: MIT
metadata:
  source: https://github.com/VoltAgent/awesome-design-md@fcc7028
---

# DESIGN.md Library

Each file in `designs/` is a complete DESIGN.md (Google Stitch format): YAML front matter with color, typography, radius and spacing tokens, followed by prose rules for layout, components and do's/don'ts.

## Available designs

1win airbnb airtable aljazeera apple binance bmw-m bmw bugatti cal claude clay clickhouse cohere coinbase composio cursor dell-1996 dji elevenlabs expo ferrari figma framer hashicorp hp ibm intercom jobright kraken lamborghini linear.app lovable mastercard mercury meta minimax mintlify miro mistral.ai mongodb mydealz nerdwallet nike nintendo-2001 notion nvidia ollama opencode.ai oracle oura pinterest playstation posthog raycast renault replicate resend revolut runwayml sanity sap sentry shopify slack spacex spotify starbucks stripe supabase superhuman tesla theverge together.ai uber vercel vodafone voltagent warp webflow wired wise x.ai zapier 

## How to use

1. Match the user's request to one design name above (e.g. "like Linear" -> `designs/linear.app.md`). If they haven't picked one, suggest 2-3 that fit the project's mood and let them choose.
2. Read only the chosen file(s): `designs/<name>.md`. Do not load the whole folder.
3. Either apply its tokens and rules directly while building UI, or, if the user wants the project to keep a design system, copy it to the project root as `DESIGN.md` and adapt names, colors or fonts to the project.
4. Treat these as inspiration for a design language. Do not copy a brand's logo, name, trademarks or proprietary assets into the user's product; substitute available fonts (e.g. a Google Fonts equivalent) for proprietary typefaces.
