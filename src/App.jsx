import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bar, Doughnut, Line, Pie } from 'react-chartjs-2';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import SafeIcon from './components/SafeIcon';
import { parseExcelFile } from './utils/excelParser';
import { buildChartOptions, chartComponents, colorPalettes, getCategoryIcon, parseIconOverrides, iconMappings } from './utils/chartConfigs';
import { useResizeObserver } from './hooks/useResizeObserver';

const colorClasses = {
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600'
};

const chartMap = {
  bar: Bar,
  line: Line,
  area: Line,
  pie: Pie,
  doughnut: Doughnut
};

const defaultConfig = {
  xAxis: '',
  yAxis: '',
  groupBy: '',
  aggFunc: 'sum',
  chartType: 'bar',
  showPercentage: false,
  chartTitle: 'Interactive Chart',
  xAxisLabel: '',
  yAxisLabel: '',
  showTrendline: false,
  iconOverrides: 'protection=>ShieldCheck\nfood=>Utensils\nidp=>Flag\nCFW=>Hammer'
};

const defaultVisuals = {
  colorMode: 'single',
  primaryColor: '#4f46e5',
  secondaryColor: '#ec4899',
  tertiaryColor: '#10b981',
  quaternaryColor: '#f59e0b',
  labelColorMap: {},
  borderWidth: 2,
  opacity: 0.8,
  tension: 0.4,
  shadow: false,
  grid: true,
  showIcons: true,
  borderRadius: 12,
  showDataLabels: true,
  showAxisLabels: true,
  glassBlur: 24,
  glassOpacity: 0.7,
  iconSize: 16,
  iconColor: '#64748b',
  iconOpacity: 1.0
};

const App = () => {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState('');
  const [appError, setAppError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rtlMode, setRtlMode] = useState(false);
  const [config, setConfig] = useState(defaultConfig);
  const [visuals, setVisuals] = useState(defaultVisuals);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [dynamicIconOverrides, setDynamicIconOverrides] = useState({});
  const [showIconModal, setShowIconModal] = useState(false);
  const [selectedLabelForIcon, setSelectedLabelForIcon] = useState('');
  const [selectedIconName, setSelectedIconName] = useState('');
  const [showIconSuggestions, setShowIconSuggestions] = useState(false);

  const chartRef = useRef(null);
  const chartContainerRef = useResizeObserver(() => {
    chartRef.current?.resize?.();
  });

  useEffect(() => {
    document.documentElement.dir = rtlMode ? 'rtl' : 'ltr';
  }, [rtlMode]);

  const handleError = useCallback((message) => {
    setAppError(message);
    window.setTimeout(() => setAppError(''), 5000);
  }, []);

  const processData = useCallback(
    (rows, name = 'Data Source') => {
      if (!Array.isArray(rows) || rows.length === 0) {
        handleError('The uploaded file is empty or contains unsupported data.');
        return;
      }

      const cols = Object.keys(rows[0]);
      const numericColumn = cols.find((col) => typeof rows[0][col] === 'number') || cols[0];

      setData(rows);
      setColumns(cols);
      setFileName(name);
      setConfig((prev) => ({ ...prev, xAxis: cols[0] || '', yAxis: numericColumn || '', groupBy: '' }));
    },
    [handleError]
  );

  const loadSheet = useCallback(
    (loadedWorkbook, sheetName, name) => {
      if (!loadedWorkbook || !sheetName) return;
      const sheet = loadedWorkbook.Sheets[sheetName];
      if (!sheet) {
        handleError('Selected sheet could not be found.');
        return;
      }

      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!Array.isArray(rows) || rows.length === 0) {
        handleError('The selected sheet is empty or invalid.');
        return;
      }

      processData(rows, `${name} — ${sheetName}`);
      setSelectedSheet(sheetName);
    },
    [handleError, processData]
  );

  const loadFile = async (file) => {
    if (!file) return;

    try {
      const parsed = await parseExcelFile(file);
      setWorkbook(parsed.workbook);
      setSheetNames(parsed.sheetNames);
      setFileName(file.name);

      if (parsed.sheetNames.length > 0) {
        setSelectedSheet(parsed.sheetNames[0]);
        loadSheet(parsed.workbook, parsed.sheetNames[0], file.name);
      }
    } catch (error) {
      handleError(error?.message || 'Failed to load the file.');
    }
  };

  const parsedIconOverrides = useMemo(() => parseIconOverrides(config.iconOverrides), [config.iconOverrides]);

  const iconOptions = useMemo(
    () => iconMappings.map((item) => ({ icon: item.icon, label: item.label })),
    []
  );

  const filteredIconSuggestions = useMemo(() => {
    const query = selectedIconName.trim().toLowerCase();
    if (!query) return iconOptions.slice(0, 10);
    return iconOptions
      .filter((item) =>
        item.icon.toLowerCase().includes(query) || item.label.toLowerCase().includes(query)
      )
      .slice(0, 10);
  }, [selectedIconName, iconOptions]);

  const aggregatedResults = useMemo(() => {
    if (!data.length || !config.xAxis || !config.yAxis) return null;

    const labels = [...new Set(data.map((row) => String(row[config.xAxis] ?? 'Undefined')))].sort();
    const groups = {};

    data.forEach((row) => {
      const x = String(row[config.xAxis] ?? 'Undefined');
      const groupKey = config.groupBy ? String(row[config.groupBy] ?? 'Total') : 'Primary';
      const value = parseFloat(row[config.yAxis]);

      groups[groupKey] ??= {};
      groups[groupKey][x] ??= [];

      if (!Number.isNaN(value)) {
        groups[groupKey][x].push(value);
      } else if (['count', 'unique'].includes(config.aggFunc)) {
        groups[groupKey][x].push(row[config.yAxis]);
      }
    });

    const rawDatasets = Object.keys(groups).map((groupName) => {
      const chartData = labels.map((label) => {
        const values = groups[groupName][label] || [];
        if (values.length === 0) return 0;

        switch (config.aggFunc) {
          case 'avg':
            return values.reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0) / values.length;
          case 'count':
            return values.length;
          case 'unique':
            return new Set(values).size;
          case 'max':
            return Math.max(...values.filter((item) => typeof item === 'number')) || 0;
          case 'min':
            return Math.min(...values.filter((item) => typeof item === 'number')) || 0;
          default:
            return values.reduce((sum, item) => sum + (typeof item === 'number' ? item : 0), 0);
        }
      });
      return { groupName, chartData };
    });

    const rawTotal = rawDatasets.reduce(
      (sum, dataset) => sum + dataset.chartData.reduce((inner, value) => inner + Number(value || 0), 0),
      0
    );

    const datasets = rawDatasets.map((dataset, index) => {
      const palette = [visuals.primaryColor, visuals.secondaryColor, visuals.tertiaryColor, visuals.quaternaryColor];
      const baseColor = visuals.colorMode === 'single'
        ? visuals.primaryColor
        : visuals.colorMode === 'dual'
        ? index % 2 === 0 ? visuals.primaryColor : visuals.secondaryColor
        : palette[index % palette.length];

      const alpha = Math.round(visuals.opacity * 255).toString(16).padStart(2, '0');
      const displayData = config.showPercentage
        ? dataset.chartData.map((value) => (rawTotal === 0 ? 0 : (Number(value) / rawTotal) * 100))
        : dataset.chartData;

      const resolveColor = (labelIndex) => {
        const label = labels[labelIndex];
        const overrideColor = visuals.labelColorMap[label];
        if (overrideColor) return overrideColor;

        if (!config.groupBy) {
          if (visuals.colorMode === 'dual') {
            return labelIndex % 2 === 0 ? visuals.primaryColor : visuals.secondaryColor;
          }
          if (visuals.colorMode === 'multi') {
            return palette[labelIndex % palette.length];
          }
        }

        return baseColor;
      };

      const backgroundColor = dataset.chartData.map((_, index) => `${resolveColor(index)}${alpha}`);
      const borderColor = dataset.chartData.map((_, index) => resolveColor(index));

      return {
        label: config.groupBy ? dataset.groupName : config.xAxis,
        data: displayData,
        rawData: dataset.chartData,
        backgroundColor,
        borderColor,
        borderWidth: visuals.borderWidth,
        fill: config.chartType === 'area',
        tension: visuals.tension,
        borderRadius: config.chartType === 'bar' ? visuals.borderRadius : 0,
        pointBackgroundColor: borderColor,
        pointRadius: config.chartType === 'bar' ? 0 : 4
      };
    });

    return { labels, datasets, rawTotal };
  }, [data, config, visuals]);

  const chartData = useMemo(() => {
    if (!aggregatedResults) return { labels: [], datasets: [] };
    return {
      labels: aggregatedResults.labels,
      datasets: aggregatedResults.datasets
    };
  }, [aggregatedResults]);

  const rawTotal = aggregatedResults?.rawTotal ?? 0;

  const chartOptions = useMemo(
    () => buildChartOptions(config, visuals, rawTotal),
    [config, visuals, rawTotal]
  );

  const shadowPlugin = useMemo(
    () => ({
      id: 'shadow',
      beforeDraw: (chart) => {
        if (!visuals.shadow) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 10;
      },
      afterDraw: (chart) => {
        if (!visuals.shadow) return;
        chart.ctx.restore();
      }
    }),
    [visuals.shadow]
  );

  const trendlinePlugin = useMemo(
    () => ({
      id: 'trendline',
      afterDatasetsDraw: (chart) => {
        if (!config.showTrendline || ['pie', 'doughnut'].includes(config.chartType)) return;

        const xScale = chart.scales?.x;
        const yScale = chart.scales?.y;
        if (!xScale || !yScale) return;

        const values = chart.data.labels.map((_, index) => {
          return chart.data.datasets.reduce((sum, dataset) => {
            const rawValue = dataset.rawData?.[index] ?? dataset.data?.[index] ?? 0;
            return sum + (Number(rawValue) || 0);
          }, 0);
        });

        const points = values
          .map((value, index) => ({
            x: xScale.getPixelForValue(index),
            y: yScale.getPixelForValue(config.showPercentage ? (rawTotal === 0 ? 0 : (value / rawTotal) * 100) : value)
          }))
          .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

        if (points.length < 2) return;

        const ctx = chart.ctx;
        ctx.save();
        ctx.strokeStyle = '#16a34a';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
        ctx.stroke();
        ctx.restore();
      }
    }),
    [config.showTrendline, config.chartType, config.showPercentage, rawTotal]
  );

  const chartPlugins = useMemo(() => [shadowPlugin, trendlinePlugin], [shadowPlugin, trendlinePlugin]);

  const exportPNG = async () => {
    if (!chartContainerRef.current) return;

    try {
      const scale = Math.max(3, Math.round(window.devicePixelRatio * 2));
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        logging: false,
        width: chartContainerRef.current.scrollWidth,
        height: chartContainerRef.current.scrollHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      });
      const link = document.createElement('a');
      link.download = `MEAL-Analytics-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error('Export PNG failed:', error);
      handleError('Failed to export PNG. Please try again.');
    }
  };

  const exportSVG = async () => {
    if (!chartContainerRef.current) return;

    try {
      const scale = Math.max(3, Math.round(window.devicePixelRatio * 2));
      const canvas = await html2canvas(chartContainerRef.current, {
        backgroundColor: '#ffffff',
        scale,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 0,
        logging: false,
        width: chartContainerRef.current.scrollWidth,
        height: chartContainerRef.current.scrollHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight
      });
      const imageUrl = canvas.toDataURL('image/png', 1.0);
      const svgString = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">` +
        `<image href="${imageUrl}" width="${canvas.width}" height="${canvas.height}"/></svg>`;

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `MEAL-Analytics-${Date.now()}.svg`;
      link.click();
    } catch (error) {
      console.error('Export SVG failed:', error);
      handleError('Failed to export SVG. Please try again.');
    }
  };

  const ChartComponent = chartMap[config.chartType] || Bar;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div
        className={`sidebar-backdrop fixed inset-0 bg-black/50 z-10 lg:hidden ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar-mobile fixed lg:relative z-20 h-full w-80 glass-panel border-l border-slate-200 shadow-2xl flex flex-col overflow-y-auto lg:translate-x-0 ${sidebarOpen ? 'open' : ''}`}>
        <div className="p-4 lg:p-6 border-b border-slate-100 flex items-center gap-3 bg-white">
          <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <SafeIcon name="BarChartBig" size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight">MEAL Studio</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">Professional Analytics</p>
          </div>
        </div>

        <div className="p-4 lg:p-6 space-y-6 lg:space-y-8 flex-1">
          {appError && (
            <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 error-shake">
              <SafeIcon name="AlertTriangle" size={18} className="text-red-500" />
              <p className="text-[11px] font-bold text-red-600 leading-relaxed">{appError}</p>
            </div>
          )}

          <section className="space-y-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <SafeIcon name="Database" size={12} /> Data Management
            </h3>
            <div
              role="button"
              tabIndex={0}
              onClick={() => document.getElementById('upload').click()}
              className={`p-4 lg:p-6 rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center group touch-target ${fileName ? 'bg-indigo-50/30 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300'}`}
            >
              <div className={`p-3 rounded-full mb-3 transition-transform group-hover:scale-110 ${fileName ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-300'}`}>
                <SafeIcon name={fileName ? 'FileCheck2' : 'UploadCloud'} size={24} />
              </div>
              <span className="text-[11px] font-black text-slate-600 block truncate w-full px-2">{fileName || 'Upload Excel / CSV File'}</span>
              <input id="upload" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => loadFile(event.target.files?.[0])} />
            </div>

            {sheetNames.length > 1 && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">اختر ورقة البيانات</label>
                <select
                  value={selectedSheet}
                  onChange={(event) => {
                    const sheet = event.target.value;
                    setSelectedSheet(sheet);
                    loadSheet(workbook, sheet, fileName);
                  }}
                  className="w-full p-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                >
                  {sheetNames.map((sheetName) => (
                    <option key={sheetName} value={sheetName}>{sheetName}</option>
                  ))}
                </select>
              </div>
            )}
          </section>

          {data.length > 0 && (
            <div className="space-y-6 lg:space-y-8">
              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                  <SafeIcon name="FunctionSquare" size={12} /> Statistical Operation
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {['sum', 'avg', 'count', 'unique', 'max', 'min'].map((func) => (
                    <button
                      key={func}
                      onClick={() => setConfig((prev) => ({ ...prev, aggFunc: func }))}
                      className={`py-2 px-3 rounded-xl border text-[11px] font-bold transition-all touch-target ${config.aggFunc === func ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200'}`}
                    >
                      {func.charAt(0).toUpperCase() + func.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, showPercentage: !prev.showPercentage }))}
                  className={`w-full py-2.5 mt-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-2 touch-target ${config.showPercentage ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'}`}
                >
                  <SafeIcon name="Percent" size={14} />
                  {config.showPercentage ? 'Cancel Percentage' : 'Show Results as Percentage (%)'}
                </button>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <SafeIcon name="Layout" size={12} /> Axis Layout
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block uppercase tracking-tighter">Horizontal Axis (X)</label>
                    <select
                      value={config.xAxis}
                      onChange={(event) => setConfig((prev) => ({ ...prev, xAxis: event.target.value }))}
                      className="w-full p-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    >
                      {columns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 block uppercase tracking-tighter">Vertical Axis (Y)</label>
                    <select
                      value={config.yAxis}
                      onChange={(event) => setConfig((prev) => ({ ...prev, yAxis: event.target.value }))}
                      className="w-full p-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                    >
                      {columns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-indigo-500 block uppercase tracking-tighter underline">Group By</label>
                    <select
                      value={config.groupBy}
                      onChange={(event) => setConfig((prev) => ({ ...prev, groupBy: event.target.value }))}
                      className="w-full p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs font-black shadow-sm outline-none focus:ring-2 focus:ring-indigo-200 transition-all"
                    >
                      <option value="">-- No Grouping --</option>
                      {columns.map((column) => (
                        <option key={column} value={column}>{column}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-4 bg-white p-4 lg:p-5 rounded-[2.5rem] border border-slate-100 shadow-sm">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <SafeIcon name="Type" size={12} /> Full Title Control
                </h3>
                <div className="space-y-4">
                  {['chartTitle', 'xAxisLabel', 'yAxisLabel'].map((field, index) => (
                    <div key={field}>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{field === 'chartTitle' ? 'Chart Title' : field === 'xAxisLabel' ? 'X Axis Label' : 'Y Axis Label'}</label>
                      <input
                        type="text"
                        value={config[field]}
                        onChange={(event) => setConfig((prev) => ({ ...prev, [field]: event.target.value }))}
                        className="w-full p-3 mt-1 rounded-2xl border border-slate-200 bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-100"
                        placeholder={`Enter ${field === 'chartTitle' ? 'chart title' : field === 'xAxisLabel' ? 'X axis label' : 'Y axis label'}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVisuals((prev) => ({ ...prev, grid: !prev.grid }))}
                    className={`py-2.5 rounded-xl text-[9px] font-black border transition-all flex items-center justify-center gap-2 ${visuals.grid ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                  >
                    <SafeIcon name="Grid" size={10} /> Grid
                  </button>
                  <button
                    onClick={() => setVisuals((prev) => ({ ...prev, showAxisLabels: !prev.showAxisLabels }))}
                    className={`py-2.5 rounded-xl text-[9px] font-black border transition-all flex items-center justify-center gap-2 ${visuals.showAxisLabels ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300'}`}
                  >
                    <SafeIcon name="List" size={10} /> Show Labels
                  </button>
                </div>
              </section>

              <section className="bg-slate-50 p-4 lg:p-5 rounded-[2.5rem] space-y-5 border border-slate-100 shadow-inner">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <SafeIcon name="Palette" size={12} /> Appearance Customization
                  </h3>
                  <button type="button" onClick={() => setRtlMode((prev) => !prev)} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">
                    {rtlMode ? 'LTR mode' : 'RTL mode'}
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-700 uppercase">Color Mode</span>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      {['single', 'dual', 'multi'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setVisuals((prev) => ({ ...prev, colorMode: mode }))}
                          className={`px-3 py-1 text-[9px] font-black rounded-lg transition-all ${visuals.colorMode === mode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
                        >
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-center py-1 flex-wrap">
                    {colorPalettes.map((palette, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setVisuals((prev) => ({ ...prev, colorMode: 'multi', primaryColor: palette.p, secondaryColor: palette.s, tertiaryColor: palette.t, quaternaryColor: palette.q }))}
                        className="w-6 h-6 rounded-full shadow-sm border-2 border-white hover:scale-110 transition-transform"
                        style={{ background: `linear-gradient(135deg, ${palette.p} 0%, ${palette.s} 50%, ${palette.t} 100%)` }}
                        title="Apply palette"
                      />
                    ))}
                  </div>

                  <div className="flex justify-around items-center bg-white py-3 rounded-2xl border border-slate-100">
                    {['primaryColor', 'secondaryColor', 'tertiaryColor', 'quaternaryColor'].map((field, index) => {
                      if (index >= 2 && visuals.colorMode === 'single') return null;
                      if (index === 3 && visuals.colorMode !== 'multi') return null;
                      return (
                        <div key={field} className="flex flex-col items-center gap-1.5">
                          <input
                            type="color"
                            value={visuals[field]}
                            onChange={(event) => setVisuals((prev) => ({ ...prev, [field]: event.target.value }))}
                            className="shadow-lg touch-target"
                          />
                          <span className="text-[8px] font-black uppercase text-slate-400">{field.replace('Color', '')}</span>
                        </div>
                      );
                    })}
                  </div>

                  {aggregatedResults?.labels?.length > 1 && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Label color overrides</span>
                        <button type="button" onClick={() => setVisuals((prev) => ({ ...prev, labelColorMap: {} }))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800">
                          Reset
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {aggregatedResults.labels.map((label) => (
                          <label key={label} className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 border border-slate-100">
                            <span className="text-[10px] font-black text-slate-600 truncate">{label}</span>
                            <input
                              type="color"
                              value={visuals.labelColorMap[label] || visuals.primaryColor}
                              onChange={(event) => setVisuals((prev) => ({
                                ...prev,
                                labelColorMap: { ...prev.labelColorMap, [label]: event.target.value }
                              }))}
                              className="w-10 h-10 rounded-xl border border-slate-200 p-0 touch-target"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  {[
                    { label: 'Curve Tension', value: visuals.tension, name: 'tension', min: 0, max: 1, step: 0.05 },
                    { label: 'Fill Opacity', value: visuals.opacity, name: 'opacity', min: 0.1, max: 1, step: 0.05 },
                    { label: 'Border Width', value: visuals.borderWidth, name: 'borderWidth', min: 0, max: 8, step: 1 },
                    { label: 'Background Blur', value: visuals.glassBlur, name: 'glassBlur', min: 0, max: 48, step: 1 },
                    { label: 'Card Opacity', value: visuals.glassOpacity, name: 'glassOpacity', min: 0.2, max: 1, step: 0.05 }
                  ].map((slider) => (
                    <div key={slider.name} className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight">
                        <span>{slider.label}</span>
                        <span className="text-indigo-600">{slider.name === 'opacity' || slider.name === 'glassOpacity' ? `${Math.round(slider.value * 100)}%` : `${slider.value}${slider.name === 'borderWidth' ? 'px' : ''}`}</span>
                      </div>
                      <input
                        type="range"
                        min={slider.min}
                        max={slider.max}
                        step={slider.step}
                        value={slider.value}
                        onChange={(event) => setVisuals((prev) => ({
                          ...prev,
                          [slider.name]: slider.name.includes('Width') || slider.name.includes('Blur') ? Number(event.target.value) : parseFloat(event.target.value)
                        }))}
                        className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer border border-slate-200"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { name: 'shadow', icon: 'Sun', label: 'Shadows' },
                    { name: 'grid', icon: 'Grid', label: 'Grid' },
                    { name: 'showIcons', icon: 'Smile', label: 'Data Icons' },
                    { name: 'showDataLabels', icon: 'Hash', label: 'Values' },
                    { name: 'showTrendline', icon: 'TrendingUp', label: 'Trend Line' }
                  ].map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() =>
                        item.name === 'showTrendline'
                          ? setConfig((prev) => ({ ...prev, showTrendline: !prev.showTrendline }))
                          : setVisuals((prev) => ({ ...prev, [item.name]: !prev[item.name] }))
                      }
                      className={`py-2.5 rounded-xl text-[9px] font-black border transition-all flex items-center justify-center gap-1.5 touch-target ${((item.name === 'showTrendline' ? config.showTrendline : visuals[item.name]) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300')}`}
                    >
                      <SafeIcon name={item.icon} size={10} /> {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-indigo-50 p-4 lg:p-5 rounded-[2.5rem] space-y-5 border border-indigo-100 shadow-inner">
                <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                  <SafeIcon name="Smile" size={12} /> Icon Customization
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-indigo-700 uppercase">Icon Color</span>
                    <input
                      type="color"
                      value={visuals.iconColor}
                      onChange={(event) => setVisuals((prev) => ({ ...prev, iconColor: event.target.value }))}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-lg touch-target"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase tracking-tight">
                      <span>Icon Size</span>
                      <span className="text-indigo-800">{visuals.iconSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="32"
                      step="2"
                      value={visuals.iconSize}
                      onChange={(event) => setVisuals((prev) => ({ ...prev, iconSize: Number(event.target.value) }))}
                      className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer border border-indigo-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase tracking-tight">
                      <span>Icon Opacity</span>
                      <span className="text-indigo-800">{Math.round(visuals.iconOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={visuals.iconOpacity}
                      onChange={(event) => setVisuals((prev) => ({ ...prev, iconOpacity: parseFloat(event.target.value) }))}
                      className="w-full accent-indigo-600 h-1.5 bg-white rounded-lg appearance-none cursor-pointer border border-indigo-200"
                    />
                  </div>
                </div>
              </section>

              <section className="mt-6 bg-white rounded-3xl p-4 lg:p-5 border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                  <SafeIcon name="Grid" size={14} /> Icon Overrides
                </h3>
                <p className="text-[10px] text-slate-500 leading-relaxed mb-3">
                  Write one line per match: <code>word=&gt;icon-name</code>. Supports partial search in category text.
                </p>
                <textarea
                  value={config.iconOverrides}
                  onChange={(event) => setConfig((prev) => ({ ...prev, iconOverrides: event.target.value }))}
                  rows={6}
                  className="w-full resize-none rounded-3xl border border-slate-200 p-3 text-[11px] text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </section>

              <div className="pt-6 border-t border-slate-100 space-y-3">
                <button
                  type="button"
                  onClick={exportPNG}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200"
                >
                  <SafeIcon name="Image" size={14} /> Export High-Quality PNG
                </button>
                <button
                  type="button"
                  onClick={exportSVG}
                  className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-[11px] font-black flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <SafeIcon name="Code2" size={14} /> Export Flexible SVG File
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col gap-4 lg:gap-6 p-3 lg:p-8 relative overflow-x-hidden">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="lg:hidden touch-target p-2 rounded-lg bg-white shadow-sm border border-slate-200"
          >
            <SafeIcon name="Menu" size={24} className="text-slate-700" />
          </button>
          <div>
            <h2 className="text-xl lg:text-3xl font-black text-slate-900 tracking-tight">Advanced Analytics Center</h2>
            <p className="text-slate-500 text-xs lg:text-sm font-medium mt-1">Smart Monitoring and Evaluation System for Humanitarian and Development Projects</p>
          </div>

          <div className="flex bg-white p-1.5 rounded-[2rem] shadow-sm border border-slate-200 overflow-x-auto no-scrollbar max-w-full">
            {[
              { id: 'bar', icon: 'BarChart2', label: 'Bars' },
              { id: 'line', icon: 'TrendingUp', label: 'Lines' },
              { id: 'area', icon: 'Mountain', label: 'Areas' },
              { id: 'pie', icon: 'PieChart', label: 'Pie' },
              { id: 'doughnut', icon: 'Donut', label: 'Doughnut' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, chartType: item.id }))}
                className={`px-4 lg:px-6 py-2 lg:py-3 rounded-2xl flex items-center gap-2 transition-all whitespace-nowrap touch-target ${config.chartType === item.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-indigo-600'}`}
              >
                <SafeIcon name={item.icon} size={16} />
                <span className="text-xs font-black hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div
          ref={chartContainerRef}
          className="resize-container flex rounded-[2rem] lg:rounded-[3rem] p-4 lg:p-8 flex-col items-center justify-center relative overflow-hidden shadow-soft"
          style={{ background: `rgba(255,255,255,${visuals.glassOpacity})` }}
        >
          {data.length > 0 ? (
            <motion.div className="w-full h-full flex flex-col relative" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="chart-container relative w-full h-full">
                <ChartComponent
                  key={`${config.chartType}-${config.showTrendline}-${visuals.shadow}-${visuals.showIcons}`}
                  ref={chartRef}
                  data={chartData}
                  options={chartOptions}
                  plugins={chartPlugins}
                />
              </div>
              {visuals.showIcons && aggregatedResults && (
                <div className="grid w-full max-w-full gap-2 mt-3 overflow-x-hidden" style={{ gridTemplateColumns: `repeat(${aggregatedResults.labels.length}, minmax(0, 1fr))` }}>
                  {aggregatedResults.labels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="flex items-center justify-center w-full h-9 bg-transparent border-0 shadow-none transition-transform hover:scale-105"
                      onClick={() => {
                        setSelectedLabelForIcon(label);
                        setShowIconModal(true);
                      }}
                    >
                      <SafeIcon
                        name={getCategoryIcon(label, parsedIconOverrides, dynamicIconOverrides)}
                        size={visuals.iconSize}
                        style={{ color: visuals.iconColor, opacity: visuals.iconOpacity }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div className="text-center space-y-6 lg:space-y-8 px-4" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-100 blur-3xl rounded-full opacity-40 animate-pulse" />
                <SafeIcon name="Layers3" size={60} className="mx-auto text-indigo-200 relative z-10" />
              </div>
              <div>
                <h3 className="text-lg lg:text-2xl font-black text-slate-800 italic tracking-tight">Data Pipeline Ready</h3>
                <p className="text-slate-400 text-[10px] lg:text-[11px] font-bold leading-relaxed uppercase tracking-[0.2em] mt-2">Please upload a data file to start the visual analysis process</p>
              </div>
            </motion.div>
          )}
        </div>

        {data.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {[
              { label: 'Total Records', value: data.length.toLocaleString(), icon: 'Table2', color: 'indigo' },
              { label: 'Active Variable', value: config.yAxis, icon: 'Target', color: 'emerald' },
              { label: 'Processing Mode', value: config.aggFunc.toUpperCase(), icon: 'Cpu', color: 'amber' },
              { label: 'Chart Total', value: config.showPercentage ? '100%' : (aggregatedResults?.rawTotal || 0).toLocaleString(), icon: 'Percent', color: 'rose' }
            ].map((metric) => (
              <div key={metric.label} className="bg-white p-3 lg:p-5 rounded-[2rem] border border-slate-100 flex items-center gap-3 lg:gap-4 shadow-sm hover:shadow-md transition-all">
                <div className={`${colorClasses[metric.color]} p-2.5 lg:p-3.5 rounded-xl lg:rounded-2xl flex items-center justify-center shadow-inner`}>
                  <SafeIcon name={metric.icon} size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] lg:text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{metric.label}</p>
                  <h4 className="text-[11px] lg:text-[13px] font-black text-slate-800 truncate">{metric.value}</h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showIconModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Choose Icon for "{selectedLabelForIcon}"</h3>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter icon name (e.g., Heart, mdi:heart)"
                className="w-full p-3 border border-slate-200 rounded-xl mb-2"
                value={selectedIconName}
                onChange={(e) => {
                  setSelectedIconName(e.target.value);
                  setShowIconSuggestions(true);
                }}
                onFocus={() => setShowIconSuggestions(true)}
              />
              {showIconSuggestions && filteredIconSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {filteredIconSuggestions.map((item) => (
                    <button
                      key={item.icon}
                      type="button"
                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSelectedIconName(item.icon);
                        setShowIconSuggestions(false);
                      }}
                    >
                      <SafeIcon name={item.icon} size={16} className="text-slate-500" />
                      <div className="min-w-0">
                        <div className="font-semibold">{item.icon}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.label}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setDynamicIconOverrides(prev => ({ ...prev, [selectedLabelForIcon.toLowerCase()]: selectedIconName })); setShowIconModal(false); setSelectedIconName(''); setShowIconSuggestions(false); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl">Apply</button>
              <button onClick={() => { setShowIconModal(false); setSelectedIconName(''); }} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
