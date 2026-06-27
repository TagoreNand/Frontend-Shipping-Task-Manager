import React, { useState, useEffect, useRef } from 'react';
import dragula from 'dragula';

// Sample data structure based on the requirements
const initialClients = [
  { id: 1, name: 'Ocean Freight - Container 001', description: 'Export shipment to Hamburg', status: 'backlog' },
  { id: 2, name: 'Air Freight - Package 002', description: 'Urgent medical supplies to Tokyo', status: 'backlog' },
  { id: 3, name: 'Ground Transport - Truck 003', description: 'Domestic delivery to Chicago', status: 'backlog' },
  { id: 4, name: 'Ocean Freight - Container 004', description: 'Import from Shanghai', status: 'in-progress' },
  { id: 5, name: 'Rail Freight - Car 005', description: 'Bulk goods to Denver', status: 'complete' },
  { id: 6, name: 'Air Freight - Package 006', description: 'Electronics to London', status: 'backlog' },
  { id: 7, name: 'Ocean Freight - Container 007', description: 'Raw materials from Brazil', status: 'in-progress' },
  { id: 8, name: 'Ground Transport - Truck 008', description: 'Food products to Miami', status: 'complete' }
];

const KanbanBoard = () => {
  const [clients, setClients] = useState(initialClients);
  const dragulaRef = useRef(null);

  useEffect(() => {
    // Initialize Dragula for drag and drop functionality
    const containers = [
      document.getElementById('backlog-swimlane'),
      document.getElementById('in-progress-swimlane'),
      document.getElementById('complete-swimlane')
    ].filter(Boolean);

    if (containers.length > 0) {
      dragulaRef.current = dragula(containers, {
        revertOnSpill: false,
        direction: 'vertical'
      });

      // Handle drop events to update the status
      dragulaRef.current.on('drop', (el, target, source, sibling) => {
        if (target && target.id) {
          const cardId = parseInt(el.dataset.id);
          let newStatus = '';
          
          switch (target.id) {
            case 'backlog-swimlane':
              newStatus = 'backlog';
              break;
            case 'in-progress-swimlane':
              newStatus = 'in-progress';
              break;
            case 'complete-swimlane':
              newStatus = 'complete';
              break;
            default:
              return;
          }

          setClients(prevClients => 
            prevClients.map(client => 
              client.id === cardId 
                ? { ...client, status: newStatus }
                : client
            )
          );
        }
      });

      return () => {
        if (dragulaRef.current) {
          dragulaRef.current.destroy();
        }
      };
    }
  }, []);

  const getCardColorClass = (status) => {
    switch (status) {
      case 'backlog':
        return 'bg-gray-100 border-gray-300';
      case 'in-progress':
        return 'bg-blue-100 border-blue-300';
      case 'complete':
        return 'bg-green-100 border-green-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getSwimlaneColor = (status) => {
    switch (status) {
      case 'backlog':
        return 'bg-gray-50';
      case 'in-progress':
        return 'bg-blue-50';
      case 'complete':
        return 'bg-green-50';
      default:
        return 'bg-gray-50';
    }
  };

  const filterClientsByStatus = (status) => {
    return clients.filter(client => client.status === status);
  };

  const ClientCard = ({ client }) => (
    <div
      className={`p-4 mb-3 rounded-lg border-2 shadow-sm cursor-move transition-all duration-200 hover:shadow-md ${getCardColorClass(client.status)}`}
      data-id={client.id}
    >
      <h3 className="font-semibold text-gray-800 mb-2">{client.name}</h3>
      <p className="text-gray-600 text-sm">{client.description}</p>
      <div className="mt-2 flex justify-between items-center">
        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
          client.status === 'backlog' ? 'bg-gray-200 text-gray-700' :
          client.status === 'in-progress' ? 'bg-blue-200 text-blue-700' :
          'bg-green-200 text-green-700'
        }`}>
          {client.status.replace('-', ' ').toUpperCase()}
        </span>
        <span className="text-xs text-gray-500">ID: {client.id}</span>
      </div>
    </div>
  );

  const Swimlane = ({ title, status, clients, count }) => (
    <div className={`Swimlane-column flex-1 mx-2 p-4 rounded-lg ${getSwimlaneColor(status)}`}>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">
          {title}
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">
            {count} {count === 1 ? 'item' : 'items'}
          </span>
          <div className={`w-3 h-3 rounded-full ${
            status === 'backlog' ? 'bg-gray-400' :
            status === 'in-progress' ? 'bg-blue-400' :
            'bg-green-400'
          }`}></div>
        </div>
      </div>
      <div
        id={`${status}-swimlane`}
        className="min-h-96 space-y-2"
        style={{ minHeight: '400px' }}
      >
        {clients.map(client => (
          <ClientCard key={client.id} client={client} />
        ))}
        {clients.length === 0 && (
          <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 text-sm">Drop cards here</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Shipping Requests</h1>
          <p className="text-gray-600">
            Manage your freight shipping tasks with drag-and-drop kanban workflow
          </p>
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
            <span>Total Tasks: {clients.length}</span>
            <span>Backlog: {filterClientsByStatus('backlog').length}</span>
            <span>In Progress: {filterClientsByStatus('in-progress').length}</span>
            <span>Complete: {filterClientsByStatus('complete').length}</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
          <Swimlane
            title="Backlog"
            status="backlog"
            clients={filterClientsByStatus('backlog')}
            count={filterClientsByStatus('backlog').length}
          />
          <Swimlane
            title="In Progress"
            status="in-progress"
            clients={filterClientsByStatus('in-progress')}
            count={filterClientsByStatus('in-progress').length}
          />
          <Swimlane
            title="Complete"
            status="complete"
            clients={filterClientsByStatus('complete')}
            count={filterClientsByStatus('complete').length}
          />
        </div>

        <div className="mt-8 p-4 bg-white rounded-lg shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-2">Instructions:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Drag and drop cards between swimlanes to update their status</li>
            <li>• Cards will automatically change color based on their swimlane</li>
            <li>• Reorder cards within the same swimlane by dragging up or down</li>
            <li>• All changes are reflected in real-time on the frontend</li>
          </ul>
        </div>
      </div>

      <style jsx>{`
        .gu-mirror {
          position: fixed !important;
          margin: 0 !important;
          z-index: 9999 !important;
          opacity: 0.8;
          transform: rotate(5deg);
        }
        .gu-hide {
          display: none !important;
        }
        .gu-unselectable {
          -webkit-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
        }
        .gu-transit {
          opacity: 0.2;
        }
      `}</style>
    </div>
  );
};

export default KanbanBoard;