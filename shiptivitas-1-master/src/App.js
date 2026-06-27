import React, { Component } from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import HomeTab from './HomeTab';
import Navigation from './Navigation';
import Board from './Board';
import './App.css';
import KanbanBoard from './components/KanbanBoard';

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTab: 'home',
    };
  }

  renderShippingRequests() {
    return (<Board />);
  }

  renderKanbanBoard() {
    return (<KanbanBoard />);
  }

  renderNavigation() {
    return (<Navigation
      onClick={(tabName) => this.changeTab(tabName)}
      selectedTab={this.state.selectedTab}
      />);
  }

  renderTabContent() {
    switch(this.state.selectedTab) {
      case 'home':
      default:
        return HomeTab();
      case 'shipping-requests':
        return this.renderShippingRequests();
      case 'kanban':
        return this.renderKanbanBoard();
    }
  }

  changeTab(tabName) {
    this.setState({
      selectedTab: tabName,
    });
  }

  render() {
    return (
      <div className="App">
        {this.renderNavigation()}
        
        <div className="App-body">
          {this.renderTabContent()}
        </div>
      </div>
    );
  }
}

export default App;