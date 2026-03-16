# Solar PV Executive Dashboard

A comprehensive React-based dashboard for executives to monitor solar targets, compare load vs solar production, track financial metrics, and view key performance indicators.

## Features

### 📊 Key Metrics
- **Real-time Solar Production**: Current generation, daily, monthly, and yearly production
- **Target Progress**: Visual progress tracking against monthly and yearly targets
- **Financial Performance**: ROI, savings, investment recovery, and carbon offset metrics

### 📈 Visualizations
- **Production vs Targets**: Line chart showing daily solar production against targets over the last 15 days
- **Load vs Solar**: Combined chart comparing load consumption with solar production, including net export calculations

### 💡 Executive Insights
- Current system capacity utilization
- Performance status indicators (On Track, Behind, Ahead)
- Projected annual savings and environmental impact
- Investment payback tracking

## Technology Stack

- **React** with TypeScript for type safety
- **Vite** for fast development and building
- **Recharts** for interactive data visualizations
- **Lucide React** for modern icons
- **date-fns** for date manipulation

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone the repository or download the project files
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server:
```bash
npm run dev
```

The dashboard will be available at [http://localhost:5173](http://localhost:5173)

### Build for Production

Build the optimized production bundle:
```bash
npm run build
```

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

```
src/
├── components/           # React components
│   ├── Dashboard.tsx    # Main dashboard layout
│   ├── SolarMetrics.tsx # Solar production metrics
│   ├── TargetProgress.tsx # Target tracking component
│   ├── FinancialMetrics.tsx # Financial performance
│   ├── ProductionChart.tsx # Production vs targets chart
│   └── LoadVsSolarChart.tsx # Load comparison chart
├── data/                # Mock data and types
│   └── mockData.ts      # Sample solar data
├── App.tsx             # Main app component
├── App.css             # Global styles
└── main.tsx           # Application entry point
```

## Data Integration

The dashboard currently uses mock data for demonstration. To integrate with real solar data:

1. Replace the mock data in `src/data/mockData.ts` with API calls to your solar monitoring system
2. Update the data types if needed to match your data structure
3. Consider adding data refresh intervals for real-time updates

## Customization

### Adding New Metrics
1. Update the data models in `mockData.ts`
2. Create new components in the `components/` directory
3. Add them to the main `Dashboard.tsx` component

### Styling
- Global styles are in `App.css`
- Component-specific styles can be added inline or as CSS modules
- The color scheme and layout can be customized in the CSS variables

## Production Considerations

- Replace mock data with actual API integration
- Add authentication if needed
- Consider adding data caching for performance
- Set up monitoring and error tracking
- Add responsive design for mobile devices
- Implement data refresh intervals

## License

This project is provided as-is for demonstration purposes.