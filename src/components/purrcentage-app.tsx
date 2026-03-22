import {
	Calculator,
	CalendarRange,
	Cat,
	Eye,
	EyeOff,
	Info,
	Pencil,
	Plus,
	RefreshCcw,
	Scale,
	Sparkles,
	Trash2,
} from "lucide-react";
import { startTransition, useEffect, useState } from "react";

import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldContent,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	type AppTab,
	loadPersistedAppState,
	PERSISTED_APP_STATE_VERSION,
	savePersistedAppState,
} from "@/lib/persistence";
import {
	addTransitionPhase,
	buildDefaultTransitionPhases,
	type CupAmountDisplay,
	calculatePercentageForServing,
	calculateServingForPercentage,
	calculateSimplePlan,
	calculateTransitionPlan,
	createBlankFood,
	type ExpandedDayPlan,
	estimateDailyCalories,
	type FoodEntry,
	type FoodUnit,
	formatCupAmount,
	formatTransitionRangeLabel,
	formatUnitAmount,
	hasCustomTransitionPhases,
	normalizePhasePercentagesForFoods,
	rebalanceTransitionPhases,
	removeTransitionPhase,
	syncSimpleInputs,
	syncTransitionPhases,
	type TransitionPhase,
	type WeightUnit,
} from "@/lib/purrcentage";
import { cn } from "@/lib/utils";

function parseNumber(value: string) {
	if (!value) {
		return 0;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function parseWholeNumber(value: string) {
	return Math.max(0, Math.floor(parseNumber(value)));
}

function formatCalories(value: number) {
	return `${Math.round(value)} kcal`;
}

function formatPercent(value: number) {
	return `${value.toFixed(1)}%`;
}

function formatEditableNumber(value: number, digits = 2) {
	return Number.isFinite(value) ? value.toFixed(digits) : "0";
}

function formatDayCount(value: number) {
	return `${value} ${value === 1 ? "day" : "days"}`;
}

type TransitionDayGroup = {
	phaseId: string;
	phaseLabel: string;
	dayCount: number;
	foods: ExpandedDayPlan["foods"];
	totalCalories: number;
};

function groupTransitionDays(days: ExpandedDayPlan[]): TransitionDayGroup[] {
	return days.reduce<TransitionDayGroup[]>((groups, day) => {
		const current = groups.at(-1);

		if (current && current.phaseId === day.phaseId) {
			current.dayCount += 1;
			return groups;
		}

		groups.push({
			phaseId: day.phaseId,
			phaseLabel: day.phaseLabel,
			dayCount: 1,
			foods: day.foods,
			totalCalories: day.totalCalories,
		});

		return groups;
	}, []);
}

function getDisplayedServingAmount(
	food: Pick<FoodEntry, "unitType">,
	servingAmount: number,
	cupAmountDisplay: CupAmountDisplay,
) {
	if (food.unitType === "cup" && cupAmountDisplay === "tablespoons") {
		return servingAmount * 16;
	}

	return servingAmount;
}

function parseDisplayedServingAmount(
	food: Pick<FoodEntry, "unitType">,
	displayAmount: number,
	cupAmountDisplay: CupAmountDisplay,
) {
	if (food.unitType === "cup" && cupAmountDisplay === "tablespoons") {
		return displayAmount / 16;
	}

	return displayAmount;
}

function getServingUnitLabel(
	food: Pick<FoodEntry, "unitType">,
	cupAmountDisplay: CupAmountDisplay,
) {
	if (food.unitType === "cup" && cupAmountDisplay === "tablespoons") {
		return "tbsp";
	}

	return food.unitType;
}

function formatServingAmountForDisplay(
	food: Pick<FoodEntry, "unitType">,
	servingAmount: number,
	cupAmountDisplay: CupAmountDisplay,
) {
	return food.unitType === "cup"
		? formatCupAmount(servingAmount, cupAmountDisplay)
		: formatUnitAmount(servingAmount, food.unitType);
}

export default function PurrcentageApp() {
	const [initialState] = useState(() => loadPersistedAppState());
	const [goalCalories, setGoalCalories] = useState(initialState.goalCalories);
	const [foods, setFoods] = useState<FoodEntry[]>(initialState.foods);
	const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
	const [simpleInputs, setSimpleInputs] = useState(initialState.simpleInputs);
	const [flexibleFoodId, setFlexibleFoodId] = useState<string>(
		initialState.flexibleFoodId,
	);
	const [phases, setPhases] = useState<TransitionPhase[]>(initialState.phases);
	const [daysPerPhase, setDaysPerPhase] = useState(initialState.daysPerPhase);
	const [weight, setWeight] = useState(initialState.weight);
	const [weightUnit, setWeightUnit] = useState<WeightUnit>(
		initialState.weightUnit,
	);
	const [ageYears, setAgeYears] = useState(initialState.ageYears);
	const [ageMonths, setAgeMonths] = useState(initialState.ageMonths);
	const [activeTab, setActiveTab] = useState<AppTab>(initialState.activeTab);
	const [cupAmountDisplay, setCupAmountDisplay] = useState<CupAmountDisplay>(
		initialState.cupAmountDisplay,
	);
	const [autoScale, setAutoScale] = useState(initialState.autoScale);

	useEffect(() => {
		const enabledFoods = foods.filter((food) => food.enabled);
		setSimpleInputs((current) => syncSimpleInputs(current, foods));
		setPhases((current) => syncTransitionPhases(current, foods));
		setFlexibleFoodId((current) => {
			if (enabledFoods.some((food) => food.id === current)) {
				return current;
			}

			return enabledFoods[0]?.id ?? "";
		});
	}, [foods]);

	useEffect(() => {
		if (!editingFoodId) {
			return;
		}

		const input = document.getElementById(
			`food-name-${editingFoodId}`,
		) as HTMLInputElement | null;
		input?.focus();
		input?.select();
	}, [editingFoodId]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			savePersistedAppState({
				version: PERSISTED_APP_STATE_VERSION,
				goalCalories,
				foods,
				simpleInputs,
				flexibleFoodId,
				phases,
				daysPerPhase,
				weight,
				weightUnit,
				ageYears,
				ageMonths,
				activeTab,
				cupAmountDisplay,
				autoScale,
			});
		}, 250);

		return () => window.clearTimeout(timeoutId);
	}, [
		activeTab,
		ageMonths,
		ageYears,
		daysPerPhase,
		flexibleFoodId,
		foods,
		goalCalories,
		phases,
		simpleInputs,
		weight,
		weightUnit,
		cupAmountDisplay,
		autoScale,
	]);

	const activeFoods = foods.filter((food) => food.enabled);
	const simplePlan = calculateSimplePlan({
		goalCalories,
		foods: activeFoods,
		inputs: simpleInputs,
		flexibleFoodId,
	});
	const transitionPlan = calculateTransitionPlan({
		goalCalories,
		foods: activeFoods,
		phases,
		daysPerPhase,
	});
	const transitionDayGroups = groupTransitionDays(transitionPlan.days);
	const calorieEstimate = estimateDailyCalories({
		weight,
		weightUnit,
		ageYears,
		ageMonths,
	});

	function updateFood(foodId: string, patch: Partial<FoodEntry>) {
		setFoods((current) =>
			current.map((food) =>
				food.id === foodId ? { ...food, ...patch } : food,
			),
		);
	}

	function removeFood(foodId: string) {
		if (foods.length === 1) {
			return;
		}

		setFoods((current) => current.filter((food) => food.id !== foodId));
	}

	function addFood() {
		startTransition(() => {
			setFoods((current) => [...current, createBlankFood(current.length + 1)]);
		});
	}

	function toggleFoodEnabled(foodId: string) {
		const nextFoods = foods.map((food) =>
			food.id === foodId ? { ...food, enabled: !food.enabled } : food,
		);

		startTransition(() => {
			setFoods(nextFoods);
			setPhases((current) =>
				current.map((phase) =>
					normalizePhasePercentagesForFoods(phase, nextFoods),
				),
			);
		});
	}

	function updateSimpleServing(foodId: string, servingAmount: number) {
		setSimpleInputs((current) => ({
			...current,
			[foodId]: {
				foodId,
				servingAmount: Math.max(0, servingAmount),
			},
		}));
	}

	function updateSimplePercentage(food: FoodEntry, percentage: number) {
		updateSimpleServing(
			food.id,
			calculateServingForPercentage(
				goalCalories,
				Math.max(0, percentage),
				food.caloriesPerUnit,
			),
		);
	}

	function updatePhasePercentage(
		phaseId: string,
		foodId: string,
		percentage: number,
	) {
		setPhases((current) =>
			current.map((phase) =>
				phase.id === phaseId
					? {
							...phase,
							percentages: {
								...phase.percentages,
								[foodId]: Math.max(0, percentage),
							},
						}
					: phase,
			),
		);
	}

	function resetPlanner() {
		startTransition(() => {
			setDaysPerPhase(2);
			setAutoScale(true);
			setPhases(buildDefaultTransitionPhases(activeFoods));
		});
	}

	function addPhase() {
		startTransition(() => {
			setPhases((current) =>
				addTransitionPhase(current, activeFoods, autoScale),
			);
		});
	}

	function removePhase(phaseId: string) {
		if (phases.length === 1) {
			return;
		}

		setPhases((current) =>
			removeTransitionPhase(current, phaseId, activeFoods, autoScale),
		);
	}

	function toggleAutoScale() {
		if (!autoScale) {
			const hasCustomPhases = hasCustomTransitionPhases(phases, activeFoods);

			if (
				hasCustomPhases &&
				!window.confirm(
					"Turning on Auto scale will replace your manual planner percentages. Continue?",
				)
			) {
				return;
			}

			startTransition(() => {
				setAutoScale(true);
				setPhases((current) => rebalanceTransitionPhases(current, activeFoods));
			});
			return;
		}

		setAutoScale(false);
	}

	function updateFoodMode(foodId: string, mode: "fixed" | "flexible") {
		if (mode === "flexible") {
			setFlexibleFoodId(foodId);
			return;
		}

		if (activeFoods.length <= 1 || flexibleFoodId !== foodId) {
			return;
		}

		const nextFood = activeFoods.find((food) => food.id !== foodId);
		if (nextFood) {
			setFlexibleFoodId(nextFood.id);
		}
	}

	function applyEstimate() {
		if (calorieEstimate.calories) {
			setGoalCalories(calorieEstimate.calories);
		}
	}

	function getPhaseLabel(index: number) {
		return formatTransitionRangeLabel(index, daysPerPhase);
	}

	function getFoodLabel(food: FoodEntry, index: number) {
		return food.name || `Food ${index + 1}`;
	}

	return (
		<div className="app-layout">
			<header className="top-bar">
				<div className="brand-mark">
					<Cat />
					<span>Purrcentage</span>
				</div>
			</header>

			<Tabs
				value={activeTab}
				onValueChange={(value) => setActiveTab(value as AppTab)}
				className="app-tabs"
			>
				<div className="mode-bar">
					<TabsList className="mode-tabs max-[767px]:grid max-[767px]:h-auto max-[767px]:w-full max-[767px]:grid-cols-2 max-[767px]:items-stretch max-[767px]:gap-1 max-[767px]:p-1">
						<TabsTrigger
							className="mode-tab-trigger max-[767px]:h-auto max-[767px]:min-h-11 max-[767px]:min-w-0 max-[767px]:w-full max-[767px]:justify-center max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:py-2 max-[767px]:text-center max-[767px]:text-[0.82rem] max-[767px]:leading-tight max-[767px]:whitespace-nowrap"
							value="simple"
						>
							<Calculator data-icon="inline-start" />
							Simple calculator
						</TabsTrigger>
						<TabsTrigger
							className="mode-tab-trigger max-[767px]:h-auto max-[767px]:min-h-11 max-[767px]:min-w-0 max-[767px]:w-full max-[767px]:justify-center max-[767px]:gap-1 max-[767px]:px-2 max-[767px]:py-2 max-[767px]:text-center max-[767px]:text-[0.82rem] max-[767px]:leading-tight max-[767px]:whitespace-nowrap"
							value="planner"
						>
							<CalendarRange data-icon="inline-start" />
							Transition planner
						</TabsTrigger>
					</TabsList>
					<label className="display-unit-control" htmlFor="cup-amount-display">
						<span className="display-unit-label">Cup results</span>
						<Select
							value={cupAmountDisplay}
							onValueChange={(value) =>
								setCupAmountDisplay(value as CupAmountDisplay)
							}
						>
							<SelectTrigger
								id="cup-amount-display"
								className="display-unit-select"
							>
								<SelectValue placeholder="Display" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									<SelectLabel>Cup results</SelectLabel>
									<SelectItem value="cups">cups</SelectItem>
									<SelectItem value="tablespoons">tbsp</SelectItem>
								</SelectGroup>
							</SelectContent>
						</Select>
					</label>
				</div>

				<div className="dashboard-grid">
					<Card className="panel-card panel-column">
						<CardHeader className="compact-header section-header">
							<CardTitle>Calorie goal per day</CardTitle>
						</CardHeader>
						<CardContent className="panel-body">
							<FieldGroup>
								<Field>
									<FieldLabel htmlFor="goal-calories">
										Calorie goal per day
									</FieldLabel>
									<FieldContent>
										<Input
											id="goal-calories"
											type="number"
											min="0"
											step="1"
											value={goalCalories}
											onChange={(event) =>
												setGoalCalories(parseNumber(event.target.value))
											}
										/>
									</FieldContent>
								</Field>
							</FieldGroup>

							<Accordion type="single" collapsible>
								<AccordionItem value="estimate">
									<AccordionTrigger>Estimate calories</AccordionTrigger>
									<AccordionContent className="flex flex-col gap-4 pt-2">
										<FieldGroup>
											<Field orientation="responsive">
												<FieldLabel htmlFor="cat-weight">Weight</FieldLabel>
												<FieldContent className="estimate-row">
													<Input
														id="cat-weight"
														type="number"
														min="0"
														step="0.1"
														value={weight}
														onChange={(event) =>
															setWeight(parseNumber(event.target.value))
														}
													/>
													<Select
														value={weightUnit}
														onValueChange={(value) =>
															setWeightUnit(value as WeightUnit)
														}
													>
														<SelectTrigger className="estimate-unit">
															<SelectValue placeholder="Unit" />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																<SelectLabel>Unit</SelectLabel>
																<SelectItem value="lb">lb</SelectItem>
																<SelectItem value="kg">kg</SelectItem>
															</SelectGroup>
														</SelectContent>
													</Select>
												</FieldContent>
											</Field>
											<Field>
												<FieldLabel htmlFor="cat-age-years">Age</FieldLabel>
												<FieldContent className="estimate-row">
													<div className="estimate-subfield">
														<span className="estimate-subfield-label">
															Years
														</span>
														<Input
															id="cat-age-years"
															type="number"
															min="0"
															step="1"
															aria-label="Age in years"
															placeholder="0"
															value={ageYears}
															onChange={(event) =>
																setAgeYears(
																	parseWholeNumber(event.target.value),
																)
															}
														/>
													</div>
													<div className="estimate-subfield">
														<span className="estimate-subfield-label">
															Months
														</span>
														<Input
															id="cat-age-months"
															type="number"
															min="0"
															max="11"
															step="1"
															aria-label="Additional months"
															placeholder="0"
															value={ageMonths}
															onChange={(event) =>
																setAgeMonths(
																	Math.min(
																		11,
																		parseWholeNumber(event.target.value),
																	),
																)
															}
														/>
													</div>
												</FieldContent>
											</Field>
										</FieldGroup>

										<Alert
											variant={
												calorieEstimate.status === "invalid"
													? "destructive"
													: "default"
											}
											className="compact-alert"
										>
											<Scale />
											<AlertTitle>
												{calorieEstimate.calories
													? formatCalories(calorieEstimate.calories)
													: "No estimate"}
											</AlertTitle>
											<AlertDescription>
												{calorieEstimate.message}
											</AlertDescription>
										</Alert>

										<Button
											type="button"
											onClick={applyEstimate}
											disabled={!calorieEstimate.calories}
										>
											<Sparkles data-icon="inline-start" />
											Use estimate
										</Button>
									</AccordionContent>
								</AccordionItem>
							</Accordion>
						</CardContent>
					</Card>

					<Card className="panel-card panel-column">
						<CardHeader className="compact-header section-header">
							<CardTitle>Foods</CardTitle>
							<CardAction className="section-action">
								<Button type="button" variant="secondary" onClick={addFood}>
									<Plus data-icon="inline-start" />
									Add food
								</Button>
							</CardAction>
						</CardHeader>
						<CardContent className="panel-scroll food-list">
							{foods.map((food, index) => (
								<Card
									key={food.id}
									size="sm"
									className={cn(
										"food-card compact-card",
										!food.enabled && "food-card-hidden",
									)}
								>
									<CardHeader className="compact-header compact-food-header">
										<CardTitle>
											{editingFoodId === food.id ? (
												<Input
													id={`food-name-${food.id}`}
													value={food.name}
													placeholder={`Food ${index + 1}`}
													aria-label={`Food ${index + 1} name`}
													className="food-title-input"
													onBlur={() => setEditingFoodId(null)}
													onChange={(event) =>
														updateFood(food.id, { name: event.target.value })
													}
													onKeyDown={(event) => {
														if (
															event.key === "Enter" ||
															event.key === "Escape"
														) {
															setEditingFoodId(null);
														}
													}}
												/>
											) : (
												<button
													type="button"
													className="food-title-display"
													onClick={() => setEditingFoodId(food.id)}
												>
													<span>{getFoodLabel(food, index)}</span>
													<Pencil aria-hidden="true" className="size-4" />
												</button>
											)}
										</CardTitle>
										<CardAction className="food-card-actions">
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label={
													food.enabled
														? `Hide ${getFoodLabel(food, index)}`
														: `Show ${getFoodLabel(food, index)}`
												}
												onClick={() => toggleFoodEnabled(food.id)}
											>
												{food.enabled ? <Eye /> : <EyeOff />}
											</Button>
											<Button
												type="button"
												variant="outline"
												size="icon-xs"
												aria-label={`Remove ${getFoodLabel(food, index)}`}
												onClick={() => removeFood(food.id)}
												disabled={foods.length === 1}
											>
												<Trash2 />
											</Button>
										</CardAction>
									</CardHeader>
									<CardContent className="compact-food-body">
										{!food.enabled ? (
											<div className="food-visibility-note">
												Hidden from calculations and planner results
											</div>
										) : null}
										<div className="compact-food-grid">
											<Field>
												<FieldLabel>Unit</FieldLabel>
												<FieldContent>
													<Select
														value={food.unitType}
														onValueChange={(value) =>
															updateFood(food.id, {
																unitType: value as FoodUnit,
															})
														}
													>
														<SelectTrigger className="w-full">
															<SelectValue placeholder="Unit" />
														</SelectTrigger>
														<SelectContent>
															<SelectGroup>
																<SelectLabel>Unit</SelectLabel>
																<SelectItem value="cup">cup</SelectItem>
																<SelectItem value="can">can</SelectItem>
															</SelectGroup>
														</SelectContent>
													</Select>
												</FieldContent>
											</Field>
											<Field>
												<FieldLabel htmlFor={`food-calories-${food.id}`}>
													kcal / {food.unitType}
												</FieldLabel>
												<FieldContent>
													<Input
														id={`food-calories-${food.id}`}
														type="number"
														min="0"
														step="1"
														value={food.caloriesPerUnit}
														onChange={(event) =>
															updateFood(food.id, {
																caloriesPerUnit: parseNumber(
																	event.target.value,
																),
															})
														}
													/>
												</FieldContent>
											</Field>
										</div>
									</CardContent>
								</Card>
							))}
						</CardContent>
					</Card>

					<TabsContent value="simple" className="mode-panel">
						<Card className="panel-card mode-card">
							<CardHeader className="compact-header section-header">
								<CardTitle>Simple calculator</CardTitle>
							</CardHeader>
							<CardContent className="mode-content">
								<div className="simple-table-layout">
									{simplePlan.issues.length > 0 ? (
										<Alert
											variant={
												simplePlan.isOverTarget ? "destructive" : "default"
											}
											className="compact-alert"
										>
											<Info />
											<AlertTitle>Check inputs</AlertTitle>
											<AlertDescription>
												{simplePlan.issues.join(" ")}
											</AlertDescription>
										</Alert>
									) : null}

									<div className="mobile-simple-list md:hidden">
										{activeFoods.map((food, index) => {
											const isFlexible = food.id === flexibleFoodId;
											const result =
												simplePlan.foods.find(
													(entry) => entry.foodId === food.id,
												) ?? null;
											const currentServing =
												simpleInputs[food.id]?.servingAmount ?? 0;
											const currentServingDisplay = getDisplayedServingAmount(
												food,
												currentServing,
												cupAmountDisplay,
											);
											const resultServingDisplay = getDisplayedServingAmount(
												food,
												result?.servingAmount ?? 0,
												cupAmountDisplay,
											);
											const currentPercentage = calculatePercentageForServing(
												goalCalories,
												currentServing,
												food.caloriesPerUnit,
											);

											return (
												<Card
													key={food.id}
													size="sm"
													className="mobile-task-card"
												>
													<CardHeader className="compact-header mobile-task-header">
														<div className="mobile-task-title">
															<CardTitle>{getFoodLabel(food, index)}</CardTitle>
															<p className="mobile-task-meta">
																{food.caloriesPerUnit} kcal / {food.unitType}
															</p>
														</div>
														<div className="mobile-task-summary">
															<span className="summary-label">Calories</span>
															<strong className="mobile-task-value">
																{formatCalories(result?.calories ?? 0)}
															</strong>
														</div>
													</CardHeader>
													<CardContent className="mobile-task-body">
														<div className="mobile-field-grid">
															<Field>
																<FieldLabel>Mode</FieldLabel>
																<FieldContent>
																	<Select
																		value={isFlexible ? "flexible" : "fixed"}
																		onValueChange={(value) =>
																			updateFoodMode(
																				food.id,
																				value as "fixed" | "flexible",
																			)
																		}
																	>
																		<SelectTrigger className="w-full">
																			<SelectValue placeholder="Mode" />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectGroup>
																				<SelectLabel>Mode</SelectLabel>
																				<SelectItem value="fixed">
																					Fixed
																				</SelectItem>
																				<SelectItem value="flexible">
																					Calculated
																				</SelectItem>
																			</SelectGroup>
																		</SelectContent>
																	</Select>
																</FieldContent>
															</Field>
															<div className="mobile-metric-grid">
																<div className="summary-block summary-block-a mobile-metric-card">
																	<span className="summary-label">
																		Target share
																	</span>
																	<strong className="mobile-metric-value">
																		{formatPercent(
																			result?.percentageOfGoal ??
																				currentPercentage,
																		)}
																	</strong>
																</div>
																<div className="summary-block summary-block-b mobile-metric-card">
																	<span className="summary-label">
																		Daily amount
																	</span>
																	<strong className="mobile-metric-value">
																		{formatServingAmountForDisplay(
																			food,
																			result?.servingAmount ?? currentServing,
																			cupAmountDisplay,
																		)}
																	</strong>
																</div>
															</div>
															<Field>
																<FieldLabel
																	htmlFor={`mobile-percentage-${food.id}`}
																>
																	Percentage
																</FieldLabel>
																<FieldContent>
																	<Input
																		id={`mobile-percentage-${food.id}`}
																		type="number"
																		min="0"
																		step="0.1"
																		value={
																			isFlexible
																				? formatEditableNumber(
																						result?.percentageOfGoal ?? 0,
																						1,
																					)
																				: currentPercentage.toFixed(1)
																		}
																		onChange={(event) =>
																			updateSimplePercentage(
																				food,
																				parseNumber(event.target.value),
																			)
																		}
																		disabled={isFlexible}
																	/>
																</FieldContent>
															</Field>
															<Field>
																<FieldLabel
																	htmlFor={`mobile-serving-${food.id}`}
																>
																	Amount
																</FieldLabel>
																<FieldContent className="mobile-serving-field">
																	<Input
																		id={`mobile-serving-${food.id}`}
																		type="number"
																		min="0"
																		step={
																			food.unitType === "cup" &&
																			cupAmountDisplay === "tablespoons"
																				? "0.1"
																				: "0.01"
																		}
																		value={
																			isFlexible
																				? formatEditableNumber(
																						resultServingDisplay,
																						food.unitType === "cup" &&
																							cupAmountDisplay === "tablespoons"
																							? 1
																							: 2,
																					)
																				: formatEditableNumber(
																						currentServingDisplay,
																						food.unitType === "cup" &&
																							cupAmountDisplay === "tablespoons"
																							? 1
																							: 2,
																					)
																		}
																		onChange={(event) =>
																			updateSimpleServing(
																				food.id,
																				parseDisplayedServingAmount(
																					food,
																					parseNumber(event.target.value),
																					cupAmountDisplay,
																				),
																			)
																		}
																		disabled={isFlexible}
																	/>
																	<span className="mobile-serving-unit">
																		{getServingUnitLabel(
																			food,
																			cupAmountDisplay,
																		)}
																	</span>
																</FieldContent>
															</Field>
														</div>
													</CardContent>
												</Card>
											);
										})}
									</div>

									<div className="hidden md:block">
										<div className="table-shell simple-table-shell">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Food</TableHead>
														<TableHead>Mode</TableHead>
														<TableHead>%</TableHead>
														<TableHead>Calories</TableHead>
														<TableHead>Amount</TableHead>
													</TableRow>
												</TableHeader>
												<TableBody>
													{activeFoods.map((food) => {
														const isFlexible = food.id === flexibleFoodId;
														const result =
															simplePlan.foods.find(
																(entry) => entry.foodId === food.id,
															) ?? null;
														const currentServing =
															simpleInputs[food.id]?.servingAmount ?? 0;
														const currentServingDisplay =
															getDisplayedServingAmount(
																food,
																currentServing,
																cupAmountDisplay,
															);
														const resultServingDisplay =
															getDisplayedServingAmount(
																food,
																result?.servingAmount ?? 0,
																cupAmountDisplay,
															);
														const currentPercentage =
															calculatePercentageForServing(
																goalCalories,
																currentServing,
																food.caloriesPerUnit,
															);

														return (
															<TableRow key={food.id}>
																<TableCell className="table-food-cell">
																	<div className="table-food-name">
																		{food.name}
																	</div>
																	<div className="table-food-meta">
																		{food.caloriesPerUnit} kcal /{" "}
																		{food.unitType}
																	</div>
																</TableCell>
																<TableCell>
																	<Select
																		value={isFlexible ? "flexible" : "fixed"}
																		onValueChange={(value) =>
																			updateFoodMode(
																				food.id,
																				value as "fixed" | "flexible",
																			)
																		}
																	>
																		<SelectTrigger className="table-control table-select">
																			<SelectValue placeholder="Mode" />
																		</SelectTrigger>
																		<SelectContent>
																			<SelectGroup>
																				<SelectLabel>Mode</SelectLabel>
																				<SelectItem value="fixed">
																					Fixed
																				</SelectItem>
																				<SelectItem value="flexible">
																					Calculated
																				</SelectItem>
																			</SelectGroup>
																		</SelectContent>
																	</Select>
																</TableCell>
																<TableCell>
																	<Input
																		id={`percentage-${food.id}`}
																		className="table-control"
																		type="number"
																		min="0"
																		step="0.1"
																		value={
																			isFlexible
																				? formatEditableNumber(
																						result?.percentageOfGoal ?? 0,
																						1,
																					)
																				: currentPercentage.toFixed(1)
																		}
																		onChange={(event) =>
																			updateSimplePercentage(
																				food,
																				parseNumber(event.target.value),
																			)
																		}
																		disabled={isFlexible}
																	/>
																</TableCell>
																<TableCell className="table-calories-cell">
																	{formatCalories(result?.calories ?? 0)}
																</TableCell>
																<TableCell>
																	<div className="table-amount-cell">
																		<Input
																			id={`serving-${food.id}`}
																			className="table-control"
																			type="number"
																			min="0"
																			step={
																				food.unitType === "cup" &&
																				cupAmountDisplay === "tablespoons"
																					? "0.1"
																					: "0.01"
																			}
																			value={
																				isFlexible
																					? formatEditableNumber(
																							resultServingDisplay,
																							food.unitType === "cup" &&
																								cupAmountDisplay ===
																									"tablespoons"
																								? 1
																								: 2,
																						)
																					: formatEditableNumber(
																							currentServingDisplay,
																							food.unitType === "cup" &&
																								cupAmountDisplay ===
																									"tablespoons"
																								? 1
																								: 2,
																						)
																			}
																			onChange={(event) =>
																				updateSimpleServing(
																					food.id,
																					parseDisplayedServingAmount(
																						food,
																						parseNumber(event.target.value),
																						cupAmountDisplay,
																					),
																				)
																			}
																			disabled={isFlexible}
																		/>
																		<span className="table-unit-label">
																			{getServingUnitLabel(
																				food,
																				cupAmountDisplay,
																			)}
																		</span>
																	</div>
																</TableCell>
															</TableRow>
														);
													})}
												</TableBody>
											</Table>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="planner" className="mode-panel">
						<Card className="panel-card mode-card planner-card">
							<CardHeader className="compact-header section-header">
								<CardTitle>Transition planner</CardTitle>
								<CardAction className="planner-actions section-action">
									<label
										className="planner-days-control"
										htmlFor="planner-days-per-step"
									>
										<span className="planner-days-label">Days per step</span>
										<Input
											id="planner-days-per-step"
											className="planner-days-input"
											type="number"
											min="1"
											step="1"
											value={daysPerPhase}
											onChange={(event) =>
												setDaysPerPhase(
													Math.max(
														1,
														Math.round(parseNumber(event.target.value)),
													),
												)
											}
										/>
									</label>
									<Button
										type="button"
										variant="outline"
										onClick={resetPlanner}
									>
										<RefreshCcw data-icon="inline-start" />
										Reset
									</Button>
									<Button type="button" variant="secondary" onClick={addPhase}>
										<Plus data-icon="inline-start" />
										Add day range
									</Button>
								</CardAction>
							</CardHeader>
							<CardContent className="mode-content planner-grid">
								<div className="planner-shell">
									{transitionPlan.issues.length > 0 ? (
										<Alert variant="destructive" className="compact-alert">
											<Info />
											<AlertTitle>Check schedule</AlertTitle>
											<AlertDescription>
												{transitionPlan.issues.join(" ")}
											</AlertDescription>
										</Alert>
									) : null}

									<div className="planner-steps">
										<div className="planner-editor-toolbar">
											<div>
												<span className="planner-days-label">
													Planner scaling
												</span>
											</div>
											<Button
												type="button"
												variant={autoScale ? "secondary" : "outline"}
												aria-pressed={autoScale}
												onClick={toggleAutoScale}
											>
												<Sparkles data-icon="inline-start" />
												Auto scale {autoScale ? "On" : "Off"}
											</Button>
										</div>
										<div className="mobile-phase-list md:hidden">
											{phases.map((phase, index) => {
												const phaseLabel = getPhaseLabel(index);

												return (
													<Card
														key={phase.id}
														size="sm"
														className="mobile-task-card mobile-phase-card"
													>
														<CardHeader className="compact-header mobile-task-header">
															<div className="mobile-task-title">
																<CardTitle>{phaseLabel}</CardTitle>
																<p className="mobile-task-meta">
																	{formatDayCount(daysPerPhase)} per range
																</p>
															</div>
															<Button
																type="button"
																variant="outline"
																size="sm"
																aria-label={`Remove ${phaseLabel}`}
																onClick={() => removePhase(phase.id)}
																disabled={phases.length === 1}
															>
																<Trash2 data-icon="inline-start" />
																Remove
															</Button>
														</CardHeader>
														<CardContent className="mobile-task-body">
															<div className="mobile-phase-grid">
																{activeFoods.map((food) => (
																	<Field key={food.id}>
																		<FieldLabel
																			htmlFor={`mobile-phase-${phase.id}-${food.id}`}
																		>
																			{food.name}
																		</FieldLabel>
																		<FieldContent>
																			<Input
																				id={`mobile-phase-${phase.id}-${food.id}`}
																				type="number"
																				min="0"
																				step="0.1"
																				value={(
																					phase.percentages[food.id] ?? 0
																				).toFixed(1)}
																				onChange={(event) =>
																					updatePhasePercentage(
																						phase.id,
																						food.id,
																						parseNumber(event.target.value),
																					)
																				}
																				disabled={autoScale}
																			/>
																		</FieldContent>
																	</Field>
																))}
															</div>
														</CardContent>
													</Card>
												);
											})}
										</div>
										<div className="hidden md:block">
											<div className="table-shell planner-editor-shell">
												<Table className="planner-editor-table">
													<TableHeader>
														<TableRow>
															<TableHead>Day range</TableHead>
															{activeFoods.map((food) => (
																<TableHead key={food.id}>{food.name}</TableHead>
															))}
															<TableHead className="planner-editor-actions-head">
																<span className="sr-only">Actions</span>
															</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{phases.map((phase, index) => {
															const phaseLabel = getPhaseLabel(index);

															return (
																<TableRow key={phase.id}>
																	<TableCell className="planner-phase-label">
																		{phaseLabel}
																	</TableCell>
																	{activeFoods.map((food) => (
																		<TableCell
																			key={food.id}
																			className="planner-editor-cell"
																		>
																			<Input
																				id={`phase-${phase.id}-${food.id}`}
																				className="planner-phase-input"
																				type="number"
																				min="0"
																				step="0.1"
																				aria-label={`${phaseLabel} ${food.name}`}
																				value={(
																					phase.percentages[food.id] ?? 0
																				).toFixed(1)}
																				onChange={(event) =>
																					updatePhasePercentage(
																						phase.id,
																						food.id,
																						parseNumber(event.target.value),
																					)
																				}
																				disabled={autoScale}
																			/>
																		</TableCell>
																	))}
																	<TableCell className="planner-editor-actions-cell">
																		<Button
																			type="button"
																			variant="outline"
																			size="sm"
																			aria-label={`Remove ${phaseLabel}`}
																			onClick={() => removePhase(phase.id)}
																			disabled={phases.length === 1}
																		>
																			<Trash2 />
																		</Button>
																	</TableCell>
																</TableRow>
															);
														})}
													</TableBody>
												</Table>
											</div>
										</div>
									</div>

									<div className="planner-results">
										<div className="planner-results-header">
											<div>
												<span className="summary-label">Daily servings</span>
												<strong className="planner-results-title">
													Day-by-day handoff
												</strong>
											</div>
										</div>

										<div className="mobile-results-list md:hidden">
											{transitionDayGroups.map((group) => (
												<Card
													key={group.phaseId}
													size="sm"
													className="mobile-task-card mobile-result-card"
												>
													<CardHeader className="compact-header mobile-task-header">
														<div className="mobile-task-title">
															<CardTitle>{group.phaseLabel}</CardTitle>
															<p className="mobile-task-meta">
																{formatDayCount(group.dayCount)}
															</p>
														</div>
														<div className="mobile-task-summary">
															<span className="summary-label">Total</span>
															<strong className="mobile-task-value">
																{formatCalories(group.totalCalories)}
															</strong>
														</div>
													</CardHeader>
													<CardContent className="mobile-task-body">
														<div className="mobile-result-foods">
															{activeFoods.map((food) => {
																const plannedFood =
																	group.foods.find(
																		(entry) => entry.foodId === food.id,
																	) ?? null;

																return (
																	<div
																		key={food.id}
																		className="mobile-result-row"
																	>
																		<div className="mobile-result-copy">
																			<div className="mobile-result-name">
																				{food.name}
																			</div>
																			<div className="mobile-result-meta">
																				{food.caloriesPerUnit} kcal /{" "}
																				{food.unitType}
																			</div>
																		</div>
																		<div className="mobile-result-value-wrap">
																			{plannedFood ? (
																				<>
																					<div className="mobile-result-value">
																						{formatServingAmountForDisplay(
																							food,
																							plannedFood.servingAmount,
																							cupAmountDisplay,
																						)}
																					</div>
																					<div className="mobile-result-percent">
																						{formatPercent(
																							plannedFood.percentageOfGoal,
																						)}
																					</div>
																				</>
																			) : (
																				<div className="mobile-result-percent">
																					-
																				</div>
																			)}
																		</div>
																	</div>
																);
															})}
														</div>
													</CardContent>
												</Card>
											))}
										</div>

										<div className="hidden md:block">
											<div className="table-shell planner-table-shell">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead>Day</TableHead>
															<TableHead>Range</TableHead>
															{activeFoods.map((food) => (
																<TableHead key={food.id}>{food.name}</TableHead>
															))}
															<TableHead>Total</TableHead>
														</TableRow>
													</TableHeader>
													<TableBody>
														{transitionPlan.days.map((day) => (
															<TableRow key={day.day}>
																<TableCell>{day.day}</TableCell>
																<TableCell>{day.phaseLabel}</TableCell>
																{activeFoods.map((food) => {
																	const plannedFood =
																		day.foods.find(
																			(entry) => entry.foodId === food.id,
																		) ?? null;

																	return (
																		<TableCell key={food.id}>
																			{plannedFood ? (
																				<div className="planner-serving">
																					<span className="planner-serving-amount">
																						{formatServingAmountForDisplay(
																							food,
																							plannedFood.servingAmount,
																							cupAmountDisplay,
																						)}
																					</span>
																					<span className="planner-serving-meta">
																						{formatPercent(
																							plannedFood.percentageOfGoal,
																						)}
																					</span>
																				</div>
																			) : (
																				<span className="planner-serving-meta">
																					-
																				</span>
																			)}
																		</TableCell>
																	);
																})}
																<TableCell>
																	<span className="planner-total">
																		{formatCalories(day.totalCalories)}
																	</span>
																</TableCell>
															</TableRow>
														))}
													</TableBody>
												</Table>
											</div>
										</div>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
