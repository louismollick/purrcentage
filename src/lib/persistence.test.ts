import { describe, expect, it, vi } from "vitest";

import {
	createDefaultAppState,
	loadPersistedAppState,
	normalizePersistedAppState,
	PERSISTED_APP_STATE_KEY,
	savePersistedAppState,
} from "./persistence";

function createStorageStub(initialValue?: string) {
	const storage = {
		value: initialValue ?? null,
		getItem: vi.fn((key: string) =>
			key === PERSISTED_APP_STATE_KEY ? storage.value : null,
		),
		setItem: vi.fn((key: string, nextValue: string) => {
			if (key === PERSISTED_APP_STATE_KEY) {
				storage.value = nextValue;
			}
		}),
	};

	return storage;
}

describe("persistence", () => {
	it("returns defaults when no saved draft exists", () => {
		const storage = createStorageStub();

		expect(loadPersistedAppState(storage)).toEqual(createDefaultAppState());
	});

	it("restores a valid saved draft", () => {
		const draft = createDefaultAppState();
		draft.goalCalories = 275;
		draft.activeTab = "planner";
		draft.simpleInputs[draft.foods[0].id].servingAmount = 0.5;
		const storage = createStorageStub(JSON.stringify(draft));

		const restored = loadPersistedAppState(storage);

		expect(restored.goalCalories).toBe(275);
		expect(restored.activeTab).toBe("planner");
		expect(restored.simpleInputs[draft.foods[0].id].servingAmount).toBe(0.5);
		expect(restored.cupAmountDisplay).toBe("cups");
		expect(restored.autoScale).toBe(true);
	});

	it("falls back to defaults when saved JSON is invalid", () => {
		const storage = createStorageStub("{");

		expect(loadPersistedAppState(storage)).toEqual(createDefaultAppState());
	});

	it("falls back to defaults for an unsupported version", () => {
		const storage = createStorageStub(
			JSON.stringify({
				...createDefaultAppState(),
				version: 99,
				goalCalories: 111,
			}),
		);

		expect(loadPersistedAppState(storage)).toEqual(createDefaultAppState());
	});

	it("normalizes malformed persisted state", () => {
		const normalized = normalizePersistedAppState({
			version: 1,
			goalCalories: -20,
			foods: [
				{
					id: "food-a",
					name: "Wet food",
					unitType: "can",
					caloriesPerUnit: -80,
				},
			],
			simpleInputs: {
				"food-a": {
					foodId: "food-a",
					servingAmount: -2,
				},
			},
			flexibleFoodId: "missing-food",
			phases: [
				{
					id: "phase-a",
					percentages: {
						"food-a": -50,
					},
				},
			],
			daysPerPhase: 0,
			weight: -1,
			weightUnit: "stone",
			ageYears: -5,
			ageMonths: 99,
			activeTab: "other",
			cupAmountDisplay: "ounces",
		});

		expect(normalized.goalCalories).toBe(0);
		expect(normalized.foods[0].caloriesPerUnit).toBe(0);
		expect(normalized.simpleInputs["food-a"].servingAmount).toBe(0);
		expect(normalized.flexibleFoodId).toBe("food-a");
		expect(normalized.phases[0].percentages["food-a"]).toBe(0);
		expect(normalized.daysPerPhase).toBe(1);
		expect(normalized.weight).toBe(0);
		expect(normalized.weightUnit).toBe("lb");
		expect(normalized.ageYears).toBe(0);
		expect(normalized.ageMonths).toBe(11);
		expect(normalized.activeTab).toBe("simple");
		expect(normalized.cupAmountDisplay).toBe("cups");
		expect(normalized.autoScale).toBe(true);
	});

	it("drops orphaned food references from saved inputs and phases", () => {
		const normalized = normalizePersistedAppState({
			version: 1,
			foods: [
				{
					id: "food-a",
					name: "Current food",
					unitType: "cup",
					caloriesPerUnit: 350,
				},
			],
			simpleInputs: {
				"food-a": {
					foodId: "food-a",
					servingAmount: 1,
				},
				"food-missing": {
					foodId: "food-missing",
					servingAmount: 2,
				},
			},
			phases: [
				{
					id: "phase-a",
					percentages: {
						"food-a": 100,
						"food-missing": 25,
					},
				},
			],
		});

		expect(Object.keys(normalized.simpleInputs)).toEqual(["food-a"]);
		expect(normalized.phases[0].percentages["food-a"]).toBe(100);
		expect(normalized.phases[0].percentages["food-missing"]).toBeUndefined();
	});

	it("persists normalized drafts using one storage key", () => {
		const storage = createStorageStub();
		const draft = createDefaultAppState();
		draft.goalCalories = 444;

		savePersistedAppState(draft, storage);

		expect(storage.setItem).toHaveBeenCalledTimes(1);
		const savedValue = JSON.parse(storage.value ?? "{}");
		expect(savedValue.goalCalories).toBe(444);
		expect(savedValue.version).toBe(1);
	});
});
