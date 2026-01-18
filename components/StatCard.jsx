"use client";
import AnimatedCounter from './AnimatedCounter';

export default function StatCard({ icon, label, value, color = 'blue', animate = true }) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 border-blue-400',
        green: 'from-green-500 to-green-600 border-green-400',
        yellow: 'from-yellow-500 to-yellow-600 border-yellow-400',
        red: 'from-red-500 to-red-600 border-red-400',
        purple: 'from-purple-500 to-purple-600 border-purple-400',
        orange: 'from-orange-500 to-orange-600 border-orange-400'
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} text-white rounded-xl p-6 shadow-lg hover:shadow-2xl transition-all hover:scale-105 border-l-4`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-4xl">{icon}</span>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                </div>
            </div>
            <div className="text-3xl font-bold mb-1">
                {animate ? <AnimatedCounter end={value} /> : value.toLocaleString()}
            </div>
            <div className="text-sm opacity-90">{label}</div>
        </div>
    );
}
