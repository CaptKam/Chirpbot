import React, { useState, useEffect } from 'react';
import { Wind, Thermometer, Cloud, Sun, CloudRain } from 'lucide-react';

interface WeatherImpactVisualizerProps {
  temperature?: number;
  windSpeed?: number;
  windDirection?: string;
  condition?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function WeatherImpactVisualizer({ 
  temperature = 72, 
  windSpeed = 8, 
  windDirection = 'NW',
  condition = 'clear',
  size = 'md' 
}: WeatherImpactVisualizerProps) {
  const [impactLevel, setImpactLevel] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    // Calculate weather impact on game
    let impact = 'low';

    if (windSpeed > 15 || temperature < 50 || temperature > 90) {
      impact = 'high';
    } else if (windSpeed > 10 || temperature < 60 || temperature > 85) {
      impact = 'medium';
    }

    setImpactLevel(impact as 'low' | 'medium' | 'high');
  }, [temperature, windSpeed]);

  const getWeatherIcon = () => {
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return <Sun className="w-4 h-4" />;
      case 'cloudy':
      case 'overcast':
        return <Cloud className="w-4 h-4" />;
      case 'rain':
      case 'rainy':
        return <CloudRain className="w-4 h-4" />;
      default:
        return <Sun className="w-4 h-4" />;
    }
  };

  const impactColor = impactLevel === 'high' ? 'text-red-400' : 
                     impactLevel === 'medium' ? 'text-yellow-400' : 'text-green-400';

  return (
    <div className={`flex items-center space-x-2 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
      {getWeatherIcon()}
      <div className="flex items-center space-x-1">
        <Thermometer className="w-3 h-3" />
        <span className="text-slate-300">{temperature}°</span>
      </div>
      <div className="flex items-center space-x-1">
        <Wind className="w-3 h-3" />
        <span className="text-slate-300">{windSpeed} {windDirection}</span>
      </div>
    </div>
  );
}

export default WeatherImpactVisualizer;