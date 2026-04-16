/**
 * Custom hook for generating smart navigation tips based on real-time crowd density
 * Analyzes zone data to recommend least crowded alternatives and estimate time savings
 */

import { useMemo } from 'react';

/**
 * Generate smart tips based on zone crowd density data
 * Compares the current zone with all available zones to find alternatives
 * and calculates estimated time savings
 *
 * @param {Array<Object>} zones Array of zone objects from Firestore
 *   Each zone should have: { id, name, status, occupancyCount, densityScore, etc. }
 * @param {string} [currentZoneId] Current zone the user is in (optional)
 * @returns {{
 *   tip: string,
 *   alternativeZone: Object|null,
 *   timeSaved: number,
 *   confidence: 'high'|'medium'|'low'
 * }}
 *   - tip: Human-readable recommendation string
 *   - alternativeZone: The recommended least crowded zone object
 *   - timeSaved: Estimated minutes saved using the alternative
 *   - confidence: Confidence level based on data availability
 *
 * @example
 * const { tip, alternativeZone, timeSaved } = useSmartTips(zones, 'gate-3');
 * // Returns: {
 * //   tip: "Gate 7 is clear. Using Gate 7 instead saves ~8 minutes.",
 * //   alternativeZone: { id: 'gate-7', name: 'Gate 7', status: 'clear', ... },
 * //   timeSaved: 8,
 * //   confidence: 'high'
 * // }
 */
export function useSmartTips(zones = [], currentZoneId) {
  return useMemo(() => {
    if (!zones || zones.length === 0) {
      return {
        tip: 'Venue data not available yet.',
        alternativeZone: null,
        timeSaved: 0,
        confidence: 'low',
      };
    }

    // Find current zone (or most crowded if not specified)
    let currentZone = currentZoneId
      ? zones.find((z) => z.id === currentZoneId)
      : zones.reduce((max, z) => (z.densityScore || 0) > (max.densityScore || 0) ? z : max);

    if (!currentZone) {
      currentZone = zones[0];
    }

    const currentDensity = currentZone.densityScore || 0;
    const currentOccupancy = currentZone.occupancyCount || 0;

    // Find least crowded zone (excluding current)
    const alternativeZone = zones
      .filter((z) => z.id !== currentZone.id)
      .reduce((least, z) => (z.densityScore || 0) < (least.densityScore || 0) ? z : least);

    if (!alternativeZone) {
      return {
        tip: `${currentZone.name || currentZone.id} is your only available zone.`,
        alternativeZone: null,
        timeSaved: 0,
        confidence: 'low',
      };
    }

    const altDensity = alternativeZone.densityScore || 0;
    const densityDiff = currentDensity - altDensity;

    // Estimate time savings: ~2 minutes per 10% density difference
    const timeSaved = Math.round((densityDiff / 0.1) * 2);
    const minTimeSaving = 2;

    // Determine confidence based on data freshness and quality
    let confidence = 'medium';
    if (densityDiff < 0.1) {
      confidence = 'low'; // Zones have similar density
    } else if (altDensity < 0.3 && currentDensity > 0.6) {
      confidence = 'high'; // Clear alternative to crowded zone
    }

    // Generate human-readable tip
    let tip = '';
    const altName = alternativeZone.name || alternativeZone.id;
    const currName = currentZone.name || currentZone.id;

    if (timeSaved < minTimeSaving) {
      tip = `${altName} has slightly lighter crowds than ${currName}.`;
    } else {
      tip = `${altName} is ${alternativeZone.status || 'clear'}. Using it instead of ${currName} saves ~${timeSaved} minutes.`;
    }

    return {
      tip,
      alternativeZone,
      timeSaved: Math.max(minTimeSaving, timeSaved),
      confidence,
    };
  }, [zones, currentZoneId]);
}

export default useSmartTips;
