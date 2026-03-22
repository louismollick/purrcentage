import { describe, expect, it } from "vitest";

import {
	addTransitionPhase,
	buildDefaultTransitionPhases,
	calculatePercentageForServing,
	calculateServingForPercentage,
	calculateSimplePlan,
	calculateTransitionPlan,
	createSimpleInputs,
	createStarterFoods,
	estimateDailyCalories,
	hasCustomTransitionPhases,
	formatCupAmount,
	formatTransitionRangeLabel,
	formatUnitAmount,
	normalizePhasePercentagesForFoods,
	rebalanceTransitionPhases,
	removeTransitionPhase,
} from "./purrcentage";

describe("serving formatting", () => {
	it("formats cup amounts with tablespoons", () => {
		expect(formatCupAmount(0.5)).toBe("0.5 cups • 8 tbsp");
	});

	it("formats cup amounts as tablespoons only when requested", () => {
		expect(formatCupAmount(0.5, "tablespoons")).toBe("8 tbsp");
	});

	it("formats can amounts as can fractions", () => {
		expect(formatUnitAmount(2.2388, "can")).toBe("2.24 cans");
	});
});

describe("simple calculator", () => {
	it("converts a fixed serving into calories and percentage", () => {
		const foods = createStarterFoods();
		const inputs = createSimpleInputs(foods);

		inputs[foods[0].id].servingAmount = 0.25;

		const result = calculateSimplePlan({
			goalCalories: 300,
			foods,
			inputs,
			flexibleFoodId: foods[1].id,
		});

		expect(result.fixedCalories).toBe(100);
		expect(result.foods[0].percentageOfGoal).toBeCloseTo(33.3333, 3);
	});

	it("keeps serving and percentage proportional", () => {
		expect(calculateServingForPercentage(300, 50, 67)).toBeCloseTo(2.2388, 4);
		expect(calculatePercentageForServing(300, 1, 67)).toBeCloseTo(22.3333, 3);
	});

	it("solves the remaining calories using one flexible food", () => {
		const foods = createStarterFoods();
		const inputs = createSimpleInputs(foods);

		inputs[foods[1].id].servingAmount = 1;

		const result = calculateSimplePlan({
			goalCalories: 300,
			foods,
			inputs,
			flexibleFoodId: foods[0].id,
		});

		const solvedFood = result.foods.find((food) => food.foodId === foods[0].id);

		expect(result.remainingCalories).toBe(215);
		expect(solvedFood?.cups).toBeCloseTo(0.5375, 4);
		expect(solvedFood?.tablespoons).toBeCloseTo(8.6, 1);
	});

	it("flags over-target fixed servings", () => {
		const foods = createStarterFoods();
		const inputs = createSimpleInputs(foods);

		inputs[foods[0].id].servingAmount = 1;

		const result = calculateSimplePlan({
			goalCalories: 300,
			foods,
			inputs,
			flexibleFoodId: foods[1].id,
		});

		expect(result.isOverTarget).toBe(true);
		expect(result.issues[0]).toContain("exceed the goal");
	});
});

describe("transition planner", () => {
	it("builds the default schedule using shared days per step", () => {
		const foods = createStarterFoods();
		const phases = buildDefaultTransitionPhases(foods);
		const result = calculateTransitionPlan({
			goalCalories: 300,
			foods,
			phases,
			daysPerPhase: 2,
		});

		expect(result.totalDays).toBe(8);
		expect(result.days).toHaveLength(8);
		expect(result.days[0].foods[0].percentageOfGoal).toBe(75);
		expect(result.days[7].foods[0].foodId).toBe(foods[1].id);
		expect(result.days[0].phaseLabel).toBe("Days 1-2");
	});

	it("requires every phase to total 100 percent", () => {
		const foods = createStarterFoods();
		const phases = buildDefaultTransitionPhases(foods);

		phases[0].percentages[foods[0].id] = 60;

		const result = calculateTransitionPlan({
			goalCalories: 300,
			foods,
			phases,
			daysPerPhase: 2,
		});

		expect(result.days).toHaveLength(0);
		expect(result.issues[0]).toBe("Days 1-2 must add up to 100%.");
	});

	it("rebalances phases into an even ramp based on count", () => {
		const foods = createStarterFoods();
		const rebalanced = rebalanceTransitionPhases(
			[
				...buildDefaultTransitionPhases(foods),
				{
					id: "phase-5",
					percentages: {
						[foods[0].id]: 0,
						[foods[1].id]: 100,
					},
				},
			],
			foods,
		);

		expect(rebalanced).toHaveLength(5);
		expect(rebalanced[0].percentages[foods[1].id]).toBe(20);
		expect(rebalanced[2].percentages[foods[1].id]).toBe(60);
		expect(rebalanced[4].percentages[foods[1].id]).toBe(100);
	});

	it("auto adjusts when adding a phase to an untouched planner", () => {
		const foods = createStarterFoods();
		const next = addTransitionPhase(
			buildDefaultTransitionPhases(foods),
			foods,
			true,
		);

		expect(next).toHaveLength(5);
		expect(next[0].percentages[foods[1].id]).toBe(20);
		expect(next[2].percentages[foods[1].id]).toBe(60);
		expect(next[4].percentages[foods[1].id]).toBe(100);
	});

	it("preserves manual planner edits when adding a phase", () => {
		const foods = createStarterFoods();
		const phases = buildDefaultTransitionPhases(foods);

		phases[0].percentages[foods[0].id] = 80;
		phases[0].percentages[foods[1].id] = 20;

		const next = addTransitionPhase(phases, foods, false);

		expect(next).toHaveLength(5);
		expect(next[0].percentages[foods[0].id]).toBe(80);
		expect(next[0].percentages[foods[1].id]).toBe(20);
		expect(next[1].percentages[foods[1].id]).toBe(50);
		expect(next[4].percentages[foods[1].id]).toBe(100);
	});

	it("auto adjusts when removing a phase from an untouched planner", () => {
		const foods = createStarterFoods();
		const phases = addTransitionPhase(
			buildDefaultTransitionPhases(foods),
			foods,
			true,
		);
		const next = removeTransitionPhase(phases, phases[2].id, foods, true);

		expect(next).toHaveLength(4);
		expect(next[0].percentages[foods[1].id]).toBe(25);
		expect(next[1].percentages[foods[1].id]).toBe(50);
		expect(next[3].percentages[foods[1].id]).toBe(100);
	});

	it("preserves manual planner edits when removing a phase", () => {
		const foods = createStarterFoods();
		const phases = buildDefaultTransitionPhases(foods);

		phases[0].percentages[foods[0].id] = 80;
		phases[0].percentages[foods[1].id] = 20;

		const next = removeTransitionPhase(phases, phases[1].id, foods, false);

		expect(next).toHaveLength(3);
		expect(next[0].percentages[foods[0].id]).toBe(80);
		expect(next[0].percentages[foods[1].id]).toBe(20);
		expect(next[1].percentages[foods[1].id]).toBe(75);
		expect(next[2].percentages[foods[1].id]).toBe(100);
	});

	it("detects when planner phases differ from the scaled schedule", () => {
		const foods = createStarterFoods();
		const phases = buildDefaultTransitionPhases(foods);

		expect(hasCustomTransitionPhases(phases, foods)).toBe(false);

		phases[0].percentages[foods[0].id] = 80;
		phases[0].percentages[foods[1].id] = 20;

		expect(hasCustomTransitionPhases(phases, foods)).toBe(true);
	});

	it("redistributes planner percentages across enabled foods", () => {
		const foods = createStarterFoods().map((food, index) => ({
			...food,
			enabled: index === 0,
		}));
		const normalized = normalizePhasePercentagesForFoods(
			{
				id: "phase-1",
				percentages: {
					[foods[0].id]: 25,
					[foods[1].id]: 75,
				},
			},
			foods,
		);

		expect(normalized.percentages[foods[0].id]).toBe(100);
		expect(normalized.percentages[foods[1].id]).toBe(0);
	});

	it("formats singular and plural day labels", () => {
		expect(formatTransitionRangeLabel(0, 1)).toBe("Day 1");
		expect(formatTransitionRangeLabel(1, 2)).toBe("Days 3-4");
	});
});

describe("calorie estimator", () => {
	it("treats partial years over one year as adult ages", () => {
		const result = estimateDailyCalories({
			weight: 10,
			weightUnit: "lb",
			ageYears: 2,
			ageMonths: 4,
		});

		expect(result.status).toBe("estimate");
		expect(result.ageBand).toBe("adult");
		expect(result.calories).toBe(206);
	});

	it("uses the 2.5x RER growth factor for kittens under 4 months", () => {
		const result = estimateDailyCalories({
			weight: 10,
			weightUnit: "lb",
			ageYears: 0,
			ageMonths: 3,
		});

		expect(result.status).toBe("caution");
		expect(result.ageBand).toBe("kitten");
		expect(result.calories).toBe(515);
	});

	it("uses the 2.0x RER growth factor for kittens from 4 to 6 months", () => {
		const result = estimateDailyCalories({
			weight: 10,
			weightUnit: "lb",
			ageYears: 0,
			ageMonths: 4,
		});

		expect(result.status).toBe("caution");
		expect(result.ageBand).toBe("kitten");
		expect(result.calories).toBe(412);
	});

	it("uses the 1.5x RER growth factor for kittens from 6 to 12 months", () => {
		const result = estimateDailyCalories({
			weight: 10,
			weightUnit: "lb",
			ageYears: 0,
			ageMonths: 8,
		});

		expect(result.status).toBe("caution");
		expect(result.ageBand).toBe("kitten");
		expect(result.calories).toBe(309);
	});
});
