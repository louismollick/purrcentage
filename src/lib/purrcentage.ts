export type FoodUnit = "cup" | "can";
export type WeightUnit = "lb" | "kg";

export type FoodEntry = {
	id: string;
	name: string;
	unitType: FoodUnit;
	caloriesPerUnit: number;
};

export type FoodAmountInput = {
	foodId: string;
	servingAmount: number;
};

export type ComputedFoodAmount = {
	foodId: string;
	foodName: string;
	unitType: FoodUnit;
	caloriesPerUnit: number;
	servingAmount: number;
	calories: number;
	percentageOfGoal: number;
	cups: number | null;
	tablespoons: number | null;
	cans: number | null;
	displayAmount: string;
	mode: "fixed" | "flexible" | "planned";
};

export type SimpleCalculationResult = {
	goalCalories: number;
	fixedCalories: number;
	totalCalories: number;
	remainingCalories: number;
	isOverTarget: boolean;
	flexibleFoodId: string | null;
	foods: ComputedFoodAmount[];
	issues: string[];
};

export type TransitionPhase = {
	id: string;
	percentages: Record<string, number>;
};

export type ExpandedDayPlan = {
	day: number;
	phaseId: string;
	phaseLabel: string;
	foods: ComputedFoodAmount[];
	totalCalories: number;
};

export type TransitionPlanResult = {
	days: ExpandedDayPlan[];
	issues: string[];
	totalDays: number;
};

export type CalorieEstimateResult = {
	status: "estimate" | "caution" | "invalid";
	calories: number | null;
	message: string;
	ageBand: "kitten" | "adult" | "senior" | "unknown";
};

const CUP_TO_TABLESPOONS = 16;

function createId(prefix: string) {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeNumber(value: number, fallback = 0) {
	return Number.isFinite(value) ? value : fallback;
}

function clampMin(value: number, min = 0) {
	return Math.max(min, sanitizeNumber(value));
}

function roundTo(value: number, digits: number) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

function pluralize(value: number, singular: string, plural: string) {
	return Math.abs(value - 1) < 0.01 ? singular : plural;
}

export function formatUnitAmount(value: number, unitType: FoodUnit) {
	const rounded = roundTo(value, 2);
	return `${rounded} ${pluralize(rounded, unitType, `${unitType}s`)}`;
}

export function formatCupAmount(cups: number) {
	const roundedCups = roundTo(cups, 2);
	const tablespoons = roundTo(cups * CUP_TO_TABLESPOONS, 1);
	return `${roundedCups} ${pluralize(roundedCups, "cup", "cups")} • ${tablespoons} tbsp`;
}

export function calculateCaloriesForServing(
	caloriesPerUnit: number,
	servingAmount: number,
) {
	return clampMin(caloriesPerUnit) * clampMin(servingAmount);
}

export function calculateServingForPercentage(
	goalCalories: number,
	percentage: number,
	caloriesPerUnit: number,
) {
	if (goalCalories <= 0 || caloriesPerUnit <= 0) {
		return 0;
	}

	return (goalCalories * clampMin(percentage)) / 100 / caloriesPerUnit;
}

export function calculatePercentageForServing(
	goalCalories: number,
	servingAmount: number,
	caloriesPerUnit: number,
) {
	if (goalCalories <= 0) {
		return 0;
	}

	return (
		(calculateCaloriesForServing(caloriesPerUnit, servingAmount) /
			goalCalories) *
		100
	);
}

function buildComputedAmount(
	food: FoodEntry,
	goalCalories: number,
	servingAmount: number,
	mode: ComputedFoodAmount["mode"],
): ComputedFoodAmount {
	const calories = calculateCaloriesForServing(
		food.caloriesPerUnit,
		servingAmount,
	);
	const cups = food.unitType === "cup" ? servingAmount : null;
	const cans = food.unitType === "can" ? servingAmount : null;

	return {
		foodId: food.id,
		foodName: food.name,
		unitType: food.unitType,
		caloriesPerUnit: food.caloriesPerUnit,
		servingAmount,
		calories,
		percentageOfGoal: goalCalories > 0 ? (calories / goalCalories) * 100 : 0,
		cups,
		tablespoons: cups === null ? null : cups * CUP_TO_TABLESPOONS,
		cans,
		displayAmount:
			food.unitType === "cup"
				? formatCupAmount(servingAmount)
				: formatUnitAmount(servingAmount, "can"),
		mode,
	};
}

export function createStarterFoods(): FoodEntry[] {
	return [
		{
			id: "food-current",
			name: "Current food",
			unitType: "cup",
			caloriesPerUnit: 400,
		},
		{
			id: "food-new",
			name: "New food",
			unitType: "can",
			caloriesPerUnit: 85,
		},
	];
}

export function createBlankFood(index: number): FoodEntry {
	return {
		id: createId("food"),
		name: `Food ${index}`,
		unitType: index % 2 === 0 ? "cup" : "can",
		caloriesPerUnit: index % 2 === 0 ? 360 : 90,
	};
}

export function createSimpleInputs(foods: FoodEntry[]) {
	return Object.fromEntries(
		foods.map((food) => [
			food.id,
			{
				foodId: food.id,
				servingAmount: 0,
			},
		]),
	) satisfies Record<string, FoodAmountInput>;
}

export function syncSimpleInputs(
	current: Record<string, FoodAmountInput>,
	foods: FoodEntry[],
) {
	return Object.fromEntries(
		foods.map((food) => [
			food.id,
			current[food.id] ?? {
				foodId: food.id,
				servingAmount: 0,
			},
		]),
	) satisfies Record<string, FoodAmountInput>;
}

function buildPhasePercentages(
	foods: FoodEntry[],
	values: Array<[string, number]>,
): Record<string, number> {
	const percentages = Object.fromEntries(foods.map((food) => [food.id, 0]));

	for (const [foodId, value] of values) {
		percentages[foodId] = value;
	}

	return percentages;
}

export function createTransitionPhase(foods: FoodEntry[]): TransitionPhase {
	const fallbackFood = foods.at(-1) ?? foods[0];

	return {
		id: createId("phase"),
		percentages: buildPhasePercentages(
			foods,
			fallbackFood ? [[fallbackFood.id, 100]] : [],
		),
	};
}

function buildGradualPhasePercentages(
	foods: FoodEntry[],
	phaseIndex: number,
	phaseCount: number,
) {
	const firstFood = foods[0];
	const lastFood = foods.at(-1) ?? firstFood;

	if (!firstFood) {
		return buildPhasePercentages(foods, []);
	}

	if (!lastFood || firstFood.id === lastFood.id || phaseCount <= 1) {
		return buildPhasePercentages(foods, [[firstFood.id, 100]]);
	}

	const newFoodPercentage = roundTo(((phaseIndex + 1) / phaseCount) * 100, 1);

	return buildPhasePercentages(foods, [
		[firstFood.id, roundTo(100 - newFoodPercentage, 1)],
		[lastFood.id, newFoodPercentage],
	]);
}

export function buildDefaultTransitionPhases(
	foods: FoodEntry[],
): TransitionPhase[] {
	if (foods.length === 0) {
		return [];
	}

	const phaseCount = foods.length > 1 ? 4 : 1;

	return Array.from({ length: phaseCount }, (_, index) => ({
		id: `phase-${index + 1}`,
		percentages: buildGradualPhasePercentages(foods, index, phaseCount),
	}));
}

export function syncTransitionPhases(
	current: TransitionPhase[],
	foods: FoodEntry[],
) {
	return current.map((phase) => ({
		id: phase.id,
		percentages: buildPhasePercentages(
			foods,
			foods
				.filter((food) => phase.percentages[food.id] !== undefined)
				.map((food) => [food.id, phase.percentages[food.id]]),
		),
	}));
}

export function rebalanceTransitionPhases(
	current: TransitionPhase[],
	foods: FoodEntry[],
) {
	return current.map((phase, index) => ({
		...phase,
		percentages: buildGradualPhasePercentages(foods, index, current.length),
	}));
}

export function formatTransitionRangeLabel(
	phaseIndex: number,
	daysPerPhase: number,
) {
	const safeDaysPerPhase = Math.max(
		1,
		Math.round(sanitizeNumber(daysPerPhase, 1)),
	);
	const startDay = phaseIndex * safeDaysPerPhase + 1;
	const endDay = startDay + safeDaysPerPhase - 1;

	return safeDaysPerPhase === 1
		? `Day ${startDay}`
		: `Days ${startDay}-${endDay}`;
}

export function sumPhasePercentages(
	phase: TransitionPhase,
	foods: FoodEntry[],
) {
	return foods.reduce(
		(total, food) => total + clampMin(phase.percentages[food.id] ?? 0),
		0,
	);
}

export function calculateSimplePlan(args: {
	goalCalories: number;
	foods: FoodEntry[];
	inputs: Record<string, FoodAmountInput>;
	flexibleFoodId: string | null;
}): SimpleCalculationResult {
	const { goalCalories, foods, inputs, flexibleFoodId } = args;
	const issues: string[] = [];
	const saneGoal = clampMin(goalCalories);

	if (foods.length === 0) {
		return {
			goalCalories: saneGoal,
			fixedCalories: 0,
			totalCalories: 0,
			remainingCalories: saneGoal,
			isOverTarget: false,
			flexibleFoodId,
			foods: [],
			issues: ["Add at least one food to calculate a plan."],
		};
	}

	if (saneGoal <= 0) {
		issues.push("Enter a daily calorie goal above 0.");
	}

	const flexibleFood = foods.find((food) => food.id === flexibleFoodId) ?? null;
	const fixedFoods = foods.filter((food) => food.id !== flexibleFoodId);

	for (const food of foods) {
		if (food.caloriesPerUnit <= 0) {
			issues.push(`${food.name || "Food"} needs calories per unit above 0.`);
		}
	}

	const fixedResults = fixedFoods.map((food) =>
		buildComputedAmount(
			food,
			saneGoal,
			clampMin(inputs[food.id]?.servingAmount ?? 0),
			"fixed",
		),
	);

	const fixedCalories = fixedResults.reduce(
		(total, result) => total + result.calories,
		0,
	);
	const remainingCalories = saneGoal - fixedCalories;
	const isOverTarget = remainingCalories < 0;

	let flexibleResult: ComputedFoodAmount | null = null;

	if (remainingCalories > 0) {
		if (!flexibleFood) {
			issues.push("Choose one food to solve the remaining calories with.");
		} else if (flexibleFood.caloriesPerUnit <= 0) {
			issues.push(
				`${flexibleFood.name || "Solved food"} needs calories per unit above 0.`,
			);
		} else {
			flexibleResult = buildComputedAmount(
				flexibleFood,
				saneGoal,
				remainingCalories / flexibleFood.caloriesPerUnit,
				"flexible",
			);
		}
	}

	if (isOverTarget) {
		issues.push(
			`Fixed servings already exceed the goal by ${roundTo(
				Math.abs(remainingCalories),
				1,
			)} kcal.`,
		);
	}

	const foodsInOrder = foods
		.map((food) =>
			food.id === flexibleResult?.foodId
				? flexibleResult
				: (fixedResults.find((result) => result.foodId === food.id) ?? null),
		)
		.filter((result): result is ComputedFoodAmount => result !== null);

	return {
		goalCalories: saneGoal,
		fixedCalories,
		totalCalories: fixedCalories + (flexibleResult?.calories ?? 0),
		remainingCalories,
		isOverTarget,
		flexibleFoodId,
		foods: foodsInOrder,
		issues,
	};
}

export function calculateTransitionPlan(args: {
	goalCalories: number;
	foods: FoodEntry[];
	phases: TransitionPhase[];
	daysPerPhase: number;
}): TransitionPlanResult {
	const { goalCalories, foods, phases, daysPerPhase } = args;
	const issues: string[] = [];
	const saneGoal = clampMin(goalCalories);

	if (foods.length === 0) {
		return {
			days: [],
			issues: ["Add at least one food before creating a transition plan."],
			totalDays: 0,
		};
	}

	if (saneGoal <= 0) {
		issues.push("Enter a daily calorie goal above 0 before planning.");
	}

	for (const food of foods) {
		if (food.caloriesPerUnit <= 0) {
			issues.push(`${food.name || "Food"} needs calories per unit above 0.`);
		}
	}

	if (daysPerPhase < 1 || !Number.isInteger(daysPerPhase)) {
		issues.push("Days per step must be a whole number.");
	}

	for (const [index, phase] of phases.entries()) {
		const phaseLabel = formatTransitionRangeLabel(index, daysPerPhase);
		const percentageTotal = sumPhasePercentages(phase, foods);
		if (Math.abs(percentageTotal - 100) > 0.1) {
			issues.push(`${phaseLabel} must add up to 100%.`);
		}
	}

	if (issues.length > 0) {
		return {
			days: [],
			issues,
			totalDays: phases.length * clampMin(daysPerPhase),
		};
	}

	const days: ExpandedDayPlan[] = [];
	let dayNumber = 1;

	for (const [index, phase] of phases.entries()) {
		const phaseLabel = formatTransitionRangeLabel(index, daysPerPhase);

		for (let dayIndex = 0; dayIndex < daysPerPhase; dayIndex += 1) {
			const amounts = foods
				.filter((food) => (phase.percentages[food.id] ?? 0) > 0)
				.map((food) =>
					buildComputedAmount(
						food,
						saneGoal,
						calculateServingForPercentage(
							saneGoal,
							phase.percentages[food.id] ?? 0,
							food.caloriesPerUnit,
						),
						"planned",
					),
				);

			days.push({
				day: dayNumber,
				phaseId: phase.id,
				phaseLabel,
				foods: amounts,
				totalCalories: amounts.reduce(
					(total, amount) => total + amount.calories,
					0,
				),
			});

			dayNumber += 1;
		}
	}

	return {
		days,
		issues,
		totalDays: dayNumber - 1,
	};
}

export function toKilograms(weight: number, unit: WeightUnit) {
	if (weight <= 0) {
		return 0;
	}

	return unit === "kg" ? weight : weight / 2.20462;
}

export function estimateDailyCalories(args: {
	weight: number;
	weightUnit: WeightUnit;
	ageYears: number;
}): CalorieEstimateResult {
	const weight = clampMin(args.weight);
	const ageYears = sanitizeNumber(args.ageYears, 0);

	if (weight <= 0 || ageYears < 0) {
		return {
			status: "invalid",
			calories: null,
			message: "Enter a valid weight and age to estimate calories.",
			ageBand: "unknown",
		};
	}

	const kilograms = toKilograms(weight, args.weightUnit);
	const rer = roundTo(30 * kilograms + 70, 0);

	if (ageYears < 1) {
		return {
			status: "caution",
			calories: null,
			message:
				"Kittens need age-specific feeding guidance, so use your vet or the food label instead of a flat estimate.",
			ageBand: "kitten",
		};
	}

	if (ageYears > 10) {
		return {
			status: "caution",
			calories: rer,
			message:
				"Senior cats can need more individualized calorie targets. This is a starting point only.",
			ageBand: "senior",
		};
	}

	return {
		status: "estimate",
		calories: rer,
		message:
			"Starter estimate for a healthy adult cat based on AAHA resting energy guidance.",
		ageBand: "adult",
	};
}
