# Purrcentage

Purrcentage is a static Astro app for cat owners who need to mix foods by calories while transitioning to a new diet. It supports cup-based and can-based foods, a one-shot daily calculator, and a customizable 7-day planning mode.

## Stack

- Astro
- React + TypeScript
- Tailwind CSS v4
- shadcn/ui
- Biome
- Vitest

## Local development

```bash
pnpm install
pnpm dev
```

Open the local URL from Astro, usually `http://localhost:4321`.

## Useful commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm biome check .
pnpm check
pnpm lint
pnpm format
```

`pnpm biome check .` and `pnpm check` both run Biome checks. `pnpm build` outputs the static site to `dist`.

## Deploy to Vercel

This project is fully static, so it deploys cleanly on Vercel with no server runtime or environment variables.

### Option 1: import the repo in Vercel

1. Push this project to GitHub, GitLab, or Bitbucket.
2. In Vercel, choose **Add New Project**.
3. Import the repository.
4. Use these settings if Vercel does not auto-detect them:

```text
Framework Preset: Astro
Install Command: pnpm install
Build Command: pnpm build
Output Directory: dist
```

5. Click **Deploy**.

### Option 2: deploy from the CLI

```bash
pnpm install
pnpm build
pnpm dlx vercel
```

For production deploys:

```bash
pnpm dlx vercel --prod
```

## Product behavior

- **Simple calculator**: lock in one or more known servings and solve the remaining calories with one selected food.
- **Planning mode**: edit a default 7-day transition schedule and get day-by-day serving amounts for each food.
- **Mixed units**:
  - `kcal per cup` for cup-based foods
  - `kcal per can` for canned foods
- **Output**:
  - cup foods show cups and tablespoons
  - canned foods show can fractions

## Default transition guidance

The starter 7-day schedule is based on common veterinary gradual-transition patterns and can be edited in the UI.

- VCA Animal Hospitals describes a 25% / 50% / 75% transition pattern, with each step typically lasting 2 to 3 days.
- AAHA Nutritional Assessment Guidelines note that some pets do better with gradual food changes over roughly 7 to 10 days.
- The calorie estimator uses AAHA adult feline starter guidance: `RER = 30 x body weight in kg + 70`.

Sources:

- [VCA: Creating a Weight Reduction Plan for Cats](https://vcahospitals.com/know-your-pet/creating-a-weight-reduction-plan-for-cats)
- [AAHA Nutritional Assessment Guidelines for Dogs and Cats](https://www.aaha.org/wp-content/uploads/globalassets/02-guidelines/weight-management/nutritionalassessmentguidelines.pdf)
- [AAHA: Nutrition and Weight, Young Adult Cats](https://www.aaha.org/resources/2021-aaha-aafp-feline-life-stage-guidelines/nutrition-and-weight-young-adult-cats/)

## Notes

- This tool is for planning and estimation, not diagnosis.
- Cats with medical conditions, kittens, seniors, underweight cats, and cats with poor appetite should have their feeding plan checked by a veterinarian.
