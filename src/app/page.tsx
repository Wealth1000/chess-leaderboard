'use client';

import { useState } from 'react';
import { Leaderboard, PlayerLineChart } from '@/components/Charts';
import snapshotsData from './data/snapshots.json';
import playersData from './data/players.json';

type Snapshots = typeof snapshotsData;
type Players = typeof playersData;

export default function Home() {
  const [selectedPlayer, setSelectedPlayer] = useState<string>(
    playersData.players[0]?.id || ''
  );

  const player = playersData.players.find(p => p.id === selectedPlayer);

  return (
    <main className="min-h-screen bg-gray-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">♟️ Chess Leaderboard</h1>
          <p className="text-gray-600 mt-2">Tracking our group&apos;s rating growth</p>
        </header>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Player
          </label>
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="mt-1 block w-full max-w-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {playersData.players.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <PlayerLineChart
              snapshots={snapshotsData.snapshots}
              playerId={selectedPlayer}
              playerName={player?.name || ''}
            />
          </div>

          <Leaderboard snapshots={snapshotsData.snapshots} />
        </div>

        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Group Comparison</h2>
          <div className="h-96">
            <AllPlayersChart snapshots={snapshotsData.snapshots} />
          </div>
        </div>
      </div>
    </main>
  );
}

function AllPlayersChart({ snapshots }: { snapshots: Array<{
  playerId: string;
  playerName: string;
  date: string;
  ratings: Array<{ platform: string; rating: number | null; date: string }>;
}> }) {
  const latestDate = [...new Set(snapshots.map(s => s.date))].sort().reverse()[0];
  const latestSnapshots = snapshots.filter(s => s.date === latestDate);
  
  const labels = latestSnapshots.map(s => s.playerName);
  const ratings = latestSnapshots.map(s => {
    const lichess = s.ratings.find(r => r.platform === 'lichess');
    const chessCom = s.ratings.find(r => r.platform === 'chess.com');
    return lichess?.rating || chessCom?.rating || 0;
  });

  const data = {
    labels,
    datasets: [{
      label: 'Current Rating',
      data: ratings,
      backgroundColor: [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
      ],
      borderColor: [
        'rgb(255, 99, 132)',
        'rgb(54, 162, 235)',
        'rgb(255, 206, 86)',
        'rgb(75, 192, 192)',
        'rgb(153, 102, 255)',
      ],
      borderWidth: 1,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return <BarChart data={data} options={options} />;
}

function BarChart({ data, options }: { data: any; options: any }) {
  // Simple bar chart implementation
  const maxRating = Math.max(...data.datasets[0].data, 1);
  
  return (
    <div className="flex items-end justify-around h-full pb-8 px-4">
      {data.labels.map((label: string, index: number) => {
        const rating = data.datasets[0].data[index];
        const height = (rating / maxRating) * 100;
        return (
          <div key={label} className="flex flex-col items-center">
            <span className="text-sm font-bold mb-1">{rating || '-'}</span>
            <div 
              className="w-12 bg-indigo-500 rounded-t"
              style={{ height: `${height}%`, minHeight: '4px' }}
            />
            <span className="text-xs mt-2 text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
