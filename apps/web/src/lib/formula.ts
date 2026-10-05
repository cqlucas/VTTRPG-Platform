export function evaluateFormula(formula: string, context: Record<string, number>): number {
  try {
    if (!formula) return 0;
    
    let expr = formula.toLowerCase();
    
    // Support common Math functions
    expr = expr.replace(/floor\(/g, "Math.floor(");
    expr = expr.replace(/ceil\(/g, "Math.ceil(");
    expr = expr.replace(/round\(/g, "Math.round(");
    expr = expr.replace(/abs\(/g, "Math.abs(");
    expr = expr.replace(/max\(/g, "Math.max(");
    expr = expr.replace(/min\(/g, "Math.min(");

    // Replace variables with their values
    for (const [key, value] of Object.entries(context)) {
      // Escape key for regex
      const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase();
      const regex = new RegExp(`\\b${safeKey}\\b`, "g");
      expr = expr.replace(regex, (value || 0).toString());
    }

    // Any remaining words (that are not Math.xxx) will likely cause an error, which is caught.
    const func = new Function(`return ${expr};`);
    const result = func();
    
    return typeof result === "number" && !isNaN(result) ? result : 0;
  } catch (err) {
    return 0;
  }
}
