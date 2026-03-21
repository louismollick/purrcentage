import {
	Calculator,
	CalendarRange,
	Cat,
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
	buildDefaultTransitionPhases,
	calculatePercentageForServing,
	calculateServingForPercentage,
	calculateSimplePlan,
	calculateTransitionPlan,
	createBlankFood,
	createSimpleInputs,
	createStarterFoods,
	createTransitionPhase,
	estimateDailyCalories,
	type FoodEntry,
	type FoodUnit,
	formatTransitionRangeLabel,
	formatUnitAmount,
	rebalanceTransitionPhases,
	syncSimpleInputs,
	syncTransitionPhases,
	type TransitionPhase,
	type WeightUnit,
} from "@/lib/purrcentage";

const initialFoods = createStarterFoods();

function parseNumber(value: string) {
	if (!value) {
		return 0;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
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

export default function PurrcentageApp() {
	const [goalCalories, setGoalCalories] = useState(300);
	const [foods, setFoods] = useState<FoodEntry[]>(initialFoods);
	const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
	const [simpleInputs, setSimpleInputs] = useState(() =>
		createSimpleInputs(initialFoods),
	);
	const [flexibleFoodId, setFlexibleFoodId] = useState<string>(
		initialFoods[1]?.id ?? initialFoods[0]?.id ?? "",
	);
	const [phases, setPhases] = useState<TransitionPhase[]>(() =>
		buildDefaultTransitionPhases(initialFoods),
	);
	const [daysPerPhase, setDaysPerPhase] = useState(2);
	const [weight, setWeight] = useState(10);
	const [weightUnit, setWeightUnit] = useState<WeightUnit>("lb");
	const [ageYears, setAgeYears] = useState(3);

	useEffect(() => {
		setSimpleInputs((current) => syncSimpleInputs(current, foods));
		setPhases((current) => syncTransitionPhases(current, foods));
		setFlexibleFoodId((current) => {
			if (foods.some((food) => food.id === current)) {
				return current;
			}

			return foods[0]?.id ?? "";
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

	const simplePlan = calculateSimplePlan({
		goalCalories,
		foods,
		inputs: simpleInputs,
		flexibleFoodId,
	});
	const transitionPlan = calculateTransitionPlan({
		goalCalories,
		foods,
		phases,
		daysPerPhase,
	});
	const calorieEstimate = estimateDailyCalories({
		weight,
		weightUnit,
		ageYears,
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
			setPhases(buildDefaultTransitionPhases(foods));
		});
	}

	function addPhase() {
		startTransition(() => {
			setPhases((current) => [...current, createTransitionPhase(foods)]);
		});
	}

	function removePhase(phaseId: string) {
		if (phases.length === 1) {
			return;
		}

		setPhases((current) => current.filter((phase) => phase.id !== phaseId));
	}

	function rebalancePlanner() {
		startTransition(() => {
			setPhases((current) => rebalanceTransitionPhases(current, foods));
		});
	}

	function updateFoodMode(foodId: string, mode: "fixed" | "flexible") {
		if (mode === "flexible") {
			setFlexibleFoodId(foodId);
			return;
		}

		if (foods.length <= 1 || flexibleFoodId !== foodId) {
			return;
		}

		const nextFood = foods.find((food) => food.id !== foodId);
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

	return (
		<div className="app-layout">
			<header className="top-bar">
				<div className="brand-mark">
					<Cat />
					<span>Purrcentage</span>
				</div>
			</header>

			<Tabs defaultValue="simple" className="app-tabs">
				<div className="mode-bar">
					<TabsList className="mode-tabs">
						<TabsTrigger value="simple">
							<Calculator data-icon="inline-start" />
							Simple calculator
						</TabsTrigger>
						<TabsTrigger value="planner">
							<CalendarRange data-icon="inline-start" />
							Transition planner
						</TabsTrigger>
					</TabsList>
				</div>

				<div className="dashboard-grid">
					<Card className="panel-card panel-column">
						<CardHeader className="compact-header">
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
												<FieldLabel htmlFor="cat-age">Age</FieldLabel>
												<FieldContent>
													<Input
														id="cat-age"
														type="number"
														min="0"
														step="0.1"
														value={ageYears}
														onChange={(event) =>
															setAgeYears(parseNumber(event.target.value))
														}
													/>
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
						<CardHeader className="compact-header">
							<CardTitle>Foods</CardTitle>
							<CardAction>
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
									className="food-card compact-card"
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
													<span>{food.name || `Food ${index + 1}`}</span>
													<Pencil aria-hidden="true" className="size-4" />
												</button>
											)}
										</CardTitle>
										<CardAction>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => removeFood(food.id)}
												disabled={foods.length === 1}
											>
												<Trash2 data-icon="inline-start" />
												Remove
											</Button>
										</CardAction>
									</CardHeader>
									<CardContent className="compact-food-body">
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
							<CardHeader className="compact-header">
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
												{foods.map((food) => {
													const isFlexible = food.id === flexibleFoodId;
													const result =
														simplePlan.foods.find(
															(entry) => entry.foodId === food.id,
														) ?? null;
													const currentServing =
														simpleInputs[food.id]?.servingAmount ?? 0;
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
																	{food.caloriesPerUnit} kcal / {food.unitType}
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
																		step="0.01"
																		value={
																			isFlexible
																				? formatEditableNumber(
																						result?.servingAmount ?? 0,
																						2,
																					)
																				: currentServing
																		}
																		onChange={(event) =>
																			updateSimpleServing(
																				food.id,
																				parseNumber(event.target.value),
																			)
																		}
																		disabled={isFlexible}
																	/>
																	<span className="table-unit-label">
																		{food.unitType}
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
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="planner" className="mode-panel">
						<Card className="panel-card mode-card planner-card">
							<CardHeader className="compact-header">
								<CardTitle>Transition planner</CardTitle>
								<CardAction className="planner-actions">
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
										onClick={rebalancePlanner}
									>
										<Sparkles data-icon="inline-start" />
										Auto adjust
									</Button>
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
										{phases.map((phase, index) => {
											const phaseLabel = getPhaseLabel(index);

											return (
												<Card
													key={phase.id}
													size="sm"
													className="compact-card planner-step-card"
												>
													<CardHeader className="planner-step-header">
														<CardTitle>{phaseLabel}</CardTitle>
														<CardAction className="phase-actions">
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
														</CardAction>
													</CardHeader>
													<CardContent className="planner-step-body">
														<div className="planner-step-fields">
															{foods.map((food) => (
																<label
																	key={food.id}
																	className="planner-inline-field"
																	htmlFor={`phase-${phase.id}-${food.id}`}
																>
																	<span className="planner-inline-label">
																		{food.name}
																	</span>
																	<Input
																		id={`phase-${phase.id}-${food.id}`}
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
																	/>
																</label>
															))}
														</div>
													</CardContent>
												</Card>
											);
										})}
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

										<div className="table-shell planner-table-shell">
											<Table>
												<TableHeader>
													<TableRow>
														<TableHead>Day</TableHead>
														<TableHead>Range</TableHead>
														{foods.map((food) => (
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
															{foods.map((food) => {
																const plannedFood =
																	day.foods.find(
																		(entry) => entry.foodId === food.id,
																	) ?? null;

																return (
																	<TableCell key={food.id}>
																		{plannedFood ? (
																			<div className="planner-serving">
																				<span className="planner-serving-amount">
																					{formatUnitAmount(
																						plannedFood.servingAmount,
																						plannedFood.unitType,
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
							</CardContent>
						</Card>
					</TabsContent>
				</div>
			</Tabs>
		</div>
	);
}
