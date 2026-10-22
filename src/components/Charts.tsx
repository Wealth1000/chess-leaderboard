import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Rating {
  platform: string;
  rating: number | null;
  date: string;
}

interface Snapshot {
  playerId: string;
  playerName: string;
  date: string;
  ratings: Rating[];
}

interface PlayerLineChartProps {
  snapshots: Snapshot[];
  playerId: string;
  playerName: string;
}

export function PlayerLineChart({ snapshots, playerId, playerName }: PlayerLineChartProps) {
  const playerSnapshots = useMemo(() => 
    snapshots.filter(s => s.playerId === playerId),
    [snapshots, playerId]
  );

  const chartData = useMemo(() => {
    const platforms = [...new Set(playerSnapshots.flatMap(s => s.ratings.map(r => r.platform)))];
    const dates = [...new Set(playerSnapshots.map(s => s.date))].sort();

    const datasets = platforms.map((platform, index) => {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];
      const labels = ['chess.com', 'lichess'];
      
      const data = dates.map(date => {
        const snapshot = playerSnapshots.find(s => s.date === date);
        const rating = snapshot?.ratings.find(r => r.platform === platform);
        return rating?.rating || null;
      });

      return {
        label: labels[index] || platform,
        data,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        tension: 0.3,
        fill: false,
      };
    });

    return {
      labels: dates,
      datasets,
    };
  }, [playerSnapshots]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${playerName} - Rating History`,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Rating',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
        ticks: {
          maxTicksLimit: 10,
        },
      },
    },
  };

  if (playerSnapshots.length === 0) {
    return <div className="text-gray-500">No data yet</div>;
  }

  return <Line data={chartData} options={options} />;
}

interface LeaderboardProps {
  snapshots: Snapshot[];
}

export function Leaderboard({ snapshots }: LeaderboardProps) {
  const latestDate = useMemo(() => 
    [...new Set(snapshots.map(s => s.date))].sort().reverse()[0],
    [snapshots]
  );

  const leaderboard = useMemo(() => {
    const latest = snapshots.filter(s => s.date === latestDate);
    return latest
      .map(s => {
        const lichess = s.ratings.find(r => r.platform === 'lichess');
        const chessCom = s.ratings.find(r => r.platform === 'chess.com');
        const rating = lichess?.rating || chessCom?.rating || 0;
        return { ...s, rating };
      })
      .sort((a, b) => b.rating - a.rating);
  }, [snapshots, latestDate]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Leaderboard</h2>
      <p className="text-gray-500 mb-4">Latest: {latestDate}</p>
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Rank</th>
            <th className="text-left py-2">Player</th>
            <th className="text-right py-2">Rating</th>
            <th className="text-left py-2">Platforms</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((player, index) => (
            <tr key={player.playerId} className="border-b hover:bg-gray-50">
              <td className="py-2 font-medium">{index + 1}</td>
              <td className="py-2">{player.playerName}</td>
              <td className="py-2 text-right font-bold">
                {player.rating || '-'}
              </td>
              <td className="py-2 text-sm text-gray-500">
                {player.ratings.map(r => r.platform).join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
