import { Card, CardContent } from "@/components/ui/card";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  changeDirection?: 'up' | 'down' | null;
  changeValue?: string;
  changeText?: string;
}

export function StatsCard({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  changeDirection,
  changeValue,
  changeText
}: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-neutral-500">{title}</p>
            <p className="text-2xl font-bold text-neutral-600 mt-1">{value}</p>
          </div>
          <div className={`p-3 ${iconBgColor} rounded-full`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
        
        {(changeDirection && changeValue) && (
          <div className="mt-4 flex items-center text-sm">
            <span className={`flex items-center ${changeDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {changeDirection === 'up' ? (
                <ArrowUp className="mr-1 h-4 w-4" />
              ) : (
                <ArrowDown className="mr-1 h-4 w-4" />
              )}
              <span>{changeValue}</span>
            </span>
            {changeText && <span className="text-neutral-500 ml-2">{changeText}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
