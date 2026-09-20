import { appendForecastEvaluation, readForecastById } from './reportStore';
import { evaluatePublishedForecast, type PriceObservation } from './forecastEvaluation';

export const evaluateAndPersistForecastShadow = async (input: {
  forecastId: string;
  observations: PriceObservation[];
  evaluatedAt?: number;
}) => {
  const forecast = await readForecastById(input.forecastId);
  if (!forecast) throw new Error('Forecast not found.');
  const evaluation = evaluatePublishedForecast({
    forecast,
    observations: input.observations,
    evaluatedAt: input.evaluatedAt,
  });
  await appendForecastEvaluation(evaluation);
  return evaluation;
};
