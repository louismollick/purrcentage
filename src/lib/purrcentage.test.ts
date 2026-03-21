import { describe, expect, it } from "vitest";

import {
	buildDefaultTransitionPhases,
	calculatePercentageForServing,
	calculateServingForPercentage,
	calculateSimplePlan,
	calculateTransitionPlan,
	createSimpleInputs,
	createStarterFoods,
	formatCupAmount,
	formatTransitionRangeLabel,
	formatUnitAmount,
	rebalanceTransitionPhases,
} from "./purrcentage";

describe("serving formatting", () => {
	it("formats cup amounts with tablespoons", () => {
		expect(formatCupAmount(0.5)).toBe("0.5 cups • 8 tbsp");
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

	it("formats singular and plural day labels", () => {
		expect(formatTransitionRangeLabel(0, 1)).toBe("Day 1");
		expect(formatTransitionRangeLabel(1, 2)).toBe("Days 3-4");
	});
});
