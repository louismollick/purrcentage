import {
	buildDefaultTransitionPhases,
	type CupAmountDisplay,
	createSimpleInputs,
	createStarterFoods,
	type FoodAmountInput,
	type FoodEntry,
	syncSimpleInputs,
	syncTransitionPhases,
	type TransitionPhase,
	type WeightUnit,
} from "./purrcentage";

export const PERSISTED_APP_STATE_VERSION = 1;
export const PERSISTED_APP_STATE_KEY = "purrcentage:draft:v1";

export type AppTab = "simple" | "planner";

export type PersistedAppStateV1 = {
	version: typeof PERSISTED_APP_STATE_VERSION;
	goalCalories: number;
	foods: FoodEntry[];
	simpleInputs: Record<string, FoodAmountInput>;
	flexibleFoodId: string;
	phases: TransitionPhase[];
	daysPerPhase: number;
	weight: number;
	weightUnit: WeightUnit;
	ageYears: number;
	ageMonths: number;
	activeTab: AppTab;
	cupAmountDisplay: CupAmountDisplay;
	autoScale: boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeNumber(value: unknown, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampMin(value: number, min = 0) {
	return Math.max(min, value);
}

function sanitizeWholeNumber(value: unknown, fallback: number, min = 0) {
	return Math.max(min, Math.floor(sanitizeNumber(value, fallback)));
}

function sanitizeAgeMonths(value: unknown, fallback: number) {
	return Math.min(11, sanitizeWholeNumber(value, fallback));
}

function getDefaultFlexibleFoodId(foods: FoodEntry[]) {
	return foods[1]?.id ?? foods[0]?.id ?? "";
}

function normalizeFoods(value: unknown, fallback: FoodEntry[]) {
	if (!Array.isArray(value)) {
		return fallback;
	}

	const seenFoodIds = new Set<string>();
	const foods = value
		.map((food, index) => {
			if (!isRecord(food)) {
				return null;
			}

			const id = typeof food.id === "string" ? food.id.trim() : "";
			const name =
				typeof food.name === "string" ? food.name : `Food ${index + 1}`;

			if (!id || seenFoodIds.has(id)) {
				return null;
			}

			if (food.unitType !== "cup" && food.unitType !== "can") {
				return null;
			}

			seenFoodIds.add(id);

			return {
				id,
				name,
				unitType: food.unitType,
				caloriesPerUnit: clampMin(sanitizeNumber(food.caloriesPerUnit, 0)),
				enabled: typeof food.enabled === "boolean" ? food.enabled : true,
			} satisfies FoodEntry;
		})
		.filter((food): food is FoodEntry => food !== null);

	return foods.length > 0 ? foods : fallback;
}

function normalizeSimpleInputs(
	value: unknown,
	fallback: PersistedAppStateV1["simpleInputs"],
) {
	if (!isRecord(value)) {
		return fallback;
	}

	return Object.fromEntries(
		Object.entries(value).flatMap(([foodId, input]) => {
			if (!isRecord(input)) {
				return [];
			}

			const inputFoodId =
				typeof input.foodId === "string" && input.foodId.trim()
					? input.foodId
					: foodId;

			return [
				[
					foodId,
					{
						foodId: inputFoodId,
						servingAmount: clampMin(sanitizeNumber(input.servingAmount, 0)),
					} satisfies FoodAmountInput,
				],
			];
		}),
	) satisfies PersistedAppStateV1["simpleInputs"];
}

function normalizePhases(
	value: unknown,
	fallback: TransitionPhase[],
): TransitionPhase[] {
	if (!Array.isArray(value)) {
		return fallback;
	}

	const phases = value
		.map((phase, index) => {
			if (!isRecord(phase) || !isRecord(phase.percentages)) {
				return null;
			}

			const id =
				typeof phase.id === "string" && phase.id.trim()
					? phase.id
					: `phase-${index + 1}`;

			return {
				id,
				percentages: Object.fromEntries(
					Object.entries(phase.percentages).flatMap(([foodId, percentage]) =>
						typeof foodId === "string"
							? [[foodId, clampMin(sanitizeNumber(percentage, 0))]]
							: [],
					),
				),
			} satisfies TransitionPhase;
		})
		.filter((phase): phase is TransitionPhase => phase !== null);

	return phases.length > 0 ? phases : fallback;
}

function getStorage(storage: StorageLike | null | undefined) {
	if (storage) {
		return storage;
	}

	if (typeof window === "undefined") {
		return null;
	}

	try {
		return window.localStorage;
	} catch {
		return null;
	}
}

function warnStorageIssue(error: unknown) {
	if (import.meta.env.DEV) {
		console.warn("Unable to persist Purrcentage draft.", error);
	}
}

export function createDefaultAppState(): PersistedAppStateV1 {
	const foods = createStarterFoods();

	return {
		version: PERSISTED_APP_STATE_VERSION,
		goalCalories: 300,
		foods,
		simpleInputs: createSimpleInputs(foods),
		flexibleFoodId: getDefaultFlexibleFoodId(foods),
		phases: buildDefaultTransitionPhases(foods),
		daysPerPhase: 2,
		weight: 10,
		weightUnit: "lb",
		ageYears: 3,
		ageMonths: 0,
		activeTab: "simple",
		cupAmountDisplay: "cups",
		autoScale: true,
	};
}

export function normalizePersistedAppState(
	value: unknown,
): PersistedAppStateV1 {
	const fallback = createDefaultAppState();

	if (!isRecord(value)) {
		return fallback;
	}

	const foods = normalizeFoods(value.foods, fallback.foods);
	const simpleInputs = syncSimpleInputs(
		normalizeSimpleInputs(value.simpleInputs, fallback.simpleInputs),
		foods,
	);
	const phases = normalizePhases(
		value.phases,
		buildDefaultTransitionPhases(foods),
	);
	const syncedPhases = syncTransitionPhases(phases, foods);

	return {
		version: PERSISTED_APP_STATE_VERSION,
		goalCalories: clampMin(
			sanitizeWholeNumber(value.goalCalories, fallback.goalCalories),
		),
		foods,
		simpleInputs,
		flexibleFoodId:
			typeof value.flexibleFoodId === "string" &&
			foods.some((food) => food.id === value.flexibleFoodId)
				? value.flexibleFoodId
				: getDefaultFlexibleFoodId(foods),
		phases:
			syncedPhases.length > 0
				? syncedPhases
				: buildDefaultTransitionPhases(foods),
		daysPerPhase: Math.max(
			1,
			sanitizeWholeNumber(value.daysPerPhase, fallback.daysPerPhase, 1),
		),
		weight: clampMin(sanitizeNumber(value.weight, fallback.weight)),
		weightUnit:
			value.weightUnit === "kg" || value.weightUnit === "lb"
				? value.weightUnit
				: fallback.weightUnit,
		ageYears: sanitizeWholeNumber(value.ageYears, fallback.ageYears),
		ageMonths: sanitizeAgeMonths(value.ageMonths, fallback.ageMonths),
		activeTab:
			value.activeTab === "planner" || value.activeTab === "simple"
				? value.activeTab
				: fallback.activeTab,
		cupAmountDisplay:
			value.cupAmountDisplay === "tablespoons" ||
			value.cupAmountDisplay === "cups"
				? value.cupAmountDisplay
				: fallback.cupAmountDisplay,
		autoScale: typeof value.autoScale === "boolean" ? value.autoScale : true,
	};
}

export function loadPersistedAppState(
	storage?: StorageLike | null,
): PersistedAppStateV1 {
	const resolvedStorage = getStorage(storage);

	if (!resolvedStorage) {
		return createDefaultAppState();
	}

	try {
		const storedValue = resolvedStorage.getItem(PERSISTED_APP_STATE_KEY);

		if (!storedValue) {
			return createDefaultAppState();
		}

		const parsedValue = JSON.parse(storedValue);

		if (
			!isRecord(parsedValue) ||
			parsedValue.version !== PERSISTED_APP_STATE_VERSION
		) {
			return createDefaultAppState();
		}

		return normalizePersistedAppState(parsedValue);
	} catch (error) {
		warnStorageIssue(error);
		return createDefaultAppState();
	}
}

export function savePersistedAppState(
	value: PersistedAppStateV1,
	storage?: StorageLike | null,
) {
	const resolvedStorage = getStorage(storage);

	if (!resolvedStorage) {
		return;
	}

	try {
		resolvedStorage.setItem(
			PERSISTED_APP_STATE_KEY,
			JSON.stringify(normalizePersistedAppState(value)),
		);
	} catch (error) {
		warnStorageIssue(error);
	}
}
