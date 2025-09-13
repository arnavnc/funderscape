'use client';

import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, GraphResponse, OpenAlexTopic, OpenAlexAutocomplete } from '../lib/types';
import { fetchFunderPanel } from '../lib/panel';

export default function Home() {
  const [selectedTopics, setSelectedTopics] = useState<OpenAlexAutocomplete[]>([
    {
      id: 'https://openalex.org/T11636',
      display_name: 'Machine learning',
      hint: 'the study of computer algorithms that improve automatically through experience',
      works_count: 100000,
      cited_by_count: 5000000,
      entity_type: 'topic',
    },
    {
      id: 'https://openalex.org/T13539',
      display_name: 'Artificial intelligence',
      hint: 'intelligence demonstrated by machines',
      works_count: 150000,
      cited_by_count: 8000000,
      entity_type: 'topic',
    }
  ]);
  const [topicSearchQuery, setTopicSearchQuery] = useState<string>('');
  const [topicSearchResults, setTopicSearchResults] = useState<OpenAlexAutocomplete[]>([]);
  const [isSearchingTopics, setIsSearchingTopics] = useState<boolean>(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState<boolean>(false);
  const [years, setYears] = useState<number>(5);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [panelData, setPanelData] = useState<any>(null);
  const [isLoadingPanel, setIsLoadingPanel] = useState<boolean>(false);
  const [currentWorkIndex, setCurrentWorkIndex] = useState<number>(0);
  const [textInput, setTextInput] = useState<string>('');
  const [annotatedTopics, setAnnotatedTopics] = useState<OpenAlexTopic[]>([]);
  const [activeTab, setActiveTab] = useState<'topics' | 'text'>('topics');
  const [expandedPanel, setExpandedPanel] = useState<'input' | 'content'>('input');
  
  const svgRef = useRef<SVGSVGElement>(null);

  // D3 force simulation with zoom and pan
  useEffect(() => {
    if (!graph || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    svg.attr('width', width).attr('height', height);

    // Create zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event: any) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom as any);

    // Create main container for zoomable content
    const container = svg.append('g');

    // Create force simulation with better size handling
    const simulation = d3.forceSimulation(graph.nodes as any)
      .force('link', d3.forceLink(graph.edges).id((d: any) => d.id).distance(120).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.2))
      .force('collision', d3.forceCollide().radius((d: any) => Math.sqrt(d.count) * 4 + 20))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05));

    // Create links
    const links = container.append('g')
      .selectAll('line')
      .data(graph.edges)
      .enter().append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d: any) => Math.sqrt(d.weight) * 2);

    // Create color scale for unique colors (matching legend)
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    const colorScale = d3.scaleOrdinal(colors);
    
    // Create selection rings (invisible initially)
    const rings = container.append('g')
      .selectAll('circle')
      .data(graph.nodes)
      .enter().append('circle')
      .attr('r', (d: any) => Math.sqrt(d.count) * 4 + 20)
      .attr('fill', 'none')
      .attr('stroke', '#ff6b6b')
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', '5,5')
      .style('opacity', 0)
      .style('pointer-events', 'none');

    // Create nodes
    const nodes = container.append('g')
      .selectAll('circle')
      .data(graph.nodes)
      .enter().append('circle')
      .attr('r', (d: any) => Math.sqrt(d.count) * 3 + 8)
      .attr('fill', (d: any, i: number) => colorScale(i.toString()))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', async (_event: any, d: any) => {
        // Remove selection from all rings
        rings.style('opacity', 0);
        // Add selection ring to clicked node
        rings.filter((node: any) => node.id === d.id)
          .style('opacity', 1);
        setSelectedNode(d);
        setCurrentWorkIndex(0); // Reset carousel to first work
        
        // Fetch comprehensive panel data
        setIsLoadingPanel(true);
        try {
          const topicIds = selectedTopics.map(t => t.id);
          const panelData = await fetchFunderPanel(d.id, { 
            topicIds, 
            fromYear: new Date().getFullYear() - years + 1 
          });
          setPanelData(panelData);
        } catch (error) {
          console.error('Failed to fetch panel data:', error);
          setPanelData(null);
        } finally {
          setIsLoadingPanel(false);
        }
      })
      .on('mouseover', function(event: any, d: any) {
        d3.select(this).attr('stroke', '#000').attr('stroke-width', 3);
      })
      .on('mouseout', function(event: any, d: any) {
        d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
      });

    // No labels on nodes - all names are in the legend

    // Update positions on simulation tick
    simulation.on('tick', () => {
      links
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      nodes
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);

      rings
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graph]);

  const handleAnnotateText = async () => {
    if (!textInput.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/annotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: textInput }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnnotatedTopics(data.topics || []);
      }
    } catch (error) {
      console.error('Error annotating text:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Search for topics using OpenAlex autocomplete
  const searchTopics = async (query: string) => {
    if (query.length < 2) {
      setTopicSearchResults([]);
      setShowTopicDropdown(false);
      return;
    }

    setIsSearchingTopics(true);
    try {
      const response = await fetch(`https://api.openalex.org/autocomplete/topics?q=${encodeURIComponent(query)}&mailto=arnav@gmail.com`);
      if (!response.ok) throw new Error('Failed to search topics');
      const data = await response.json();
      setTopicSearchResults(data.results || []);
      setShowTopicDropdown(true);
    } catch (error) {
      console.error('Error searching topics:', error);
      setTopicSearchResults([]);
    } finally {
      setIsSearchingTopics(false);
    }
  };

  // Add topic to selected list
  const addTopic = (topic: OpenAlexAutocomplete) => {
    if (!selectedTopics.find(t => t.id === topic.id)) {
      setSelectedTopics([...selectedTopics, topic]);
    }
    setTopicSearchQuery('');
    setShowTopicDropdown(false);
  };

  // Remove topic from selected list
  const removeTopic = (topicId: string) => {
    setSelectedTopics(selectedTopics.filter(t => t.id !== topicId));
  };

  const handleBuildGraph = async () => {
    if (selectedTopics.length === 0) return;
    
    setIsLoading(true);
    try {
      const topicIdList = selectedTopics.map(topic => topic.id);
      const response = await fetch('/api/graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: topicIdList, years })
      });
      
      if (!response.ok) throw new Error('Failed to build graph');
      const data = await response.json();
      setGraph(data);
    } catch (error) {
      console.error('Error building graph:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTopicFromAnnotation = (topic: OpenAlexTopic) => {
    const autocompleteTopic: OpenAlexAutocomplete = {
      id: topic.id,
      display_name: topic.display_name,
      hint: topic.hint,
      works_count: topic.works_count,
      cited_by_count: topic.cited_by_count,
      entity_type: topic.entity_type,
      external_id: topic.external_id,
    };
    if (!selectedTopics.find(t => t.id === topic.id)) {
      setSelectedTopics([...selectedTopics, autocompleteTopic]);
    }
  };

  // Handle topic search input changes
  const handleTopicSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setTopicSearchQuery(query);
    searchTopics(query);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.topic-search-container')) {
        setShowTopicDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="h-screen w-screen bg-white overflow-hidden">
      {/* Collapsible Layout */}
      <div className="flex h-full w-full">
        
        {/* Input Panel - Collapsible */}
        <div className={`${expandedPanel === 'input' ? 'w-1/3' : 'w-16'} transition-all duration-500 ease-in-out border-r border-gray-200 overflow-hidden relative ${expandedPanel === 'input' ? 'bg-white' : 'bg-gray-50'}`}>
          {/* Always visible toggle button */}
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'input' ? 'content' : 'input')}
              className="p-2 bg-white hover:bg-gray-50 rounded-lg shadow-md border border-gray-200 transition-all duration-200 hover:shadow-lg"
              title={expandedPanel === 'input' ? 'Show content' : 'Show input'}
            >
              <svg className="w-5 h-5 text-gray-600 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {expandedPanel === 'input' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                )}
              </svg>
            </button>
          </div>
          
          {/* Collapsed state indicator */}
          {expandedPanel !== 'input' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-5">
              <div className="text-xs text-gray-500 font-medium writing-mode-vertical-rl text-orientation-mixed">
                Input
              </div>
            </div>
          )}
          
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h1 className={`text-2xl font-bold text-indigo-700 transition-all duration-500 ${expandedPanel === 'input' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
                funderscape.
              </h1>
            </div>
            
            {expandedPanel === 'input' && (
              <div className="flex-1 space-y-4 p-6 pt-0 overflow-y-auto animate-in slide-in-from-left-4 duration-500">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('topics')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    activeTab === 'topics'
                      ? 'text-gray-900 border-b border-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Topics
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-3 py-1 text-sm font-medium transition-colors ${
                    activeTab === 'text'
                      ? 'text-gray-900 border-b border-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Text
                </button>
              </div>

              {activeTab === 'topics' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Topics
                  </label>
                  <div className="relative topic-search-container">
                    <input
                      type="text"
                      value={topicSearchQuery}
                      onChange={handleTopicSearchChange}
                      placeholder="Search for research topics..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm font-semibold text-gray-900 bg-white shadow-sm"
                    />
                    {isSearchingTopics && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                      </div>
                    )}
                    
                    {/* Dropdown with search results */}
                    {showTopicDropdown && topicSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {topicSearchResults.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => addTopic(topic)}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-semibold text-gray-900 truncate">{topic.display_name}</div>
                            {topic.hint && (
                              <div className="text-gray-600 text-xs mt-1 line-clamp-2">{topic.hint}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
        </div>
                  
                  {/* Selected topics as pills */}
                  {selectedTopics.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Selected Topics:</div>
                      <div className="max-h-20 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                        <div className="flex flex-wrap gap-1">
                          {selectedTopics.map((topic) => (
                            <div
                              key={topic.id}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium border border-blue-200"
                            >
                              <span className="truncate max-w-24">{topic.display_name}</span>
                              <button
                                onClick={() => removeTopic(topic.id)}
                                className="hover:bg-blue-200 rounded-full p-0.5 transition-colors flex-shrink-0"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Research Text
                  </label>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter research title or abstract..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-400 text-sm font-medium text-gray-900"
                    rows={3}
                  />
                  <button
                    onClick={handleAnnotateText}
                    disabled={isLoading || !textInput.trim()}
                    className="mt-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'Annotating...' : 'Find Topics'}
                  </button>
                  
                  {annotatedTopics.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">Found Topics:</h4>
                      <div className="max-h-32 overflow-y-auto space-y-2">
                        {annotatedTopics.slice(0, 3).map((topic) => (
                          <div
                            key={topic.id}
                            className="flex items-start justify-between p-2 bg-gray-50 rounded-sm"
                          >
                            <div className="flex-1 pr-2 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 mb-1 truncate">{topic.display_name}</div>
                              {topic.hint && (
                                <div className="text-xs text-gray-600 line-clamp-1">{topic.hint}</div>
                              )}
                            </div>
                            <button
                              onClick={() => addTopicFromAnnotation(topic)}
                              className="flex-shrink-0 w-5 h-5 bg-gray-900 text-white rounded-sm hover:bg-gray-800 transition-colors flex items-center justify-center"
                              title="Add topic"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years Back
                </label>
                <input
                  type="number"
                  value={years}
                  onChange={(e) => setYears(parseInt(e.target.value) || 5)}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-400 text-sm font-medium text-gray-900"
                />
              </div>

              <button
                onClick={handleBuildGraph}
                disabled={isLoading || selectedTopics.length === 0}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold shadow-sm"
              >
                {isLoading ? 'Building...' : 'Build Map'}
              </button>
              </div>
            )}
          </div>
        </div>

        {/* Content Panel - Collapsible */}
        <div className={`${expandedPanel === 'content' ? 'flex-1' : 'w-0'} transition-all duration-500 ease-in-out overflow-hidden relative ${expandedPanel === 'content' ? 'bg-white' : 'bg-gray-50'}`}>
          {/* Always visible toggle button for content panel */}
          <div className="absolute top-4 left-4 z-10">
            <button
              onClick={() => setExpandedPanel(expandedPanel === 'content' ? 'input' : 'content')}
              className="p-2 bg-white hover:bg-gray-50 rounded-lg shadow-md border border-gray-200 transition-all duration-200 hover:shadow-lg"
              title={expandedPanel === 'content' ? 'Show input' : 'Show content'}
            >
              <svg className="w-5 h-5 text-gray-600 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {expandedPanel === 'content' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                )}
              </svg>
            </button>
          </div>
          
          {/* Collapsed state indicator for content */}
          {expandedPanel !== 'content' && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-5">
              <div className="text-xs text-gray-500 font-medium writing-mode-vertical-rl text-orientation-mixed">
                Content
              </div>
            </div>
          )}
          <div className="h-full flex">
            {/* Funder Details Panel */}
            <div className="w-1/3 border-r border-gray-200 p-4 bg-gray-50/30">
          {selectedNode ? (
            <div className="h-full overflow-y-auto">
              {isLoadingPanel ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
                    <div className="text-sm text-gray-500">Loading funder details...</div>
                  </div>
                </div>
              ) : panelData ? (
                <div className="space-y-4">
                  {/* Debug: Enhanced UI with better readability */}
                        {/* Header */}
                        <header className="flex items-start gap-3">
                          {panelData.funder.image_thumbnail_url && (
                            <img 
                              src={panelData.funder.image_thumbnail_url} 
                              className="h-12 w-12 rounded-lg object-contain border border-gray-200" 
                              alt=""
                            />
                          )}
                          <div className="min-w-0">
                            <div className="text-xl font-bold text-gray-900">{panelData.funder.display_name}</div>
                            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                              {panelData.funder.country_code && (
                                <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-medium">
                                  {panelData.funder.country_code}
                                </span>
                              )}
                              {(panelData.funder.roles || []).map((r: any) => (
                                <span key={r.role} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 font-medium">
                                  {r.role}
                                </span>
                              ))}
                            </div>
                          </div>
                        </header>

                        {/* KPIs */}
                        <section className="grid grid-cols-3 gap-4 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              <svg className="w-5 h-5 text-blue-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="text-xs font-medium text-blue-700">Works (window)</div>
                            </div>
                            <div className="text-2xl font-bold text-blue-900">{panelData.kpis.worksInWindow.toLocaleString()}</div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              <svg className="w-5 h-5 text-green-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                              </svg>
                              <div className="text-xs font-medium text-green-700">Works in topic</div>
                            </div>
                            <div className="text-2xl font-bold text-green-900">
                              {panelData.kpis.worksInTopic?.toLocaleString?.() ?? '—'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="flex items-center justify-center mb-2">
                              <svg className="w-5 h-5 text-purple-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                              <div className="text-xs font-medium text-purple-700">OA share</div>
                            </div>
                            <div className="text-2xl font-bold text-purple-900">{Math.round(panelData.kpis.oaShare * 100)}%</div>
                          </div>
                          <div className="col-span-3 mt-3 pt-3 border-t border-blue-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-medium text-blue-700">Topic share</span>
                              <span className="text-sm font-bold text-blue-900">
                                {panelData.kpis.topicSharePct ? panelData.kpis.topicSharePct.toFixed(1) + '%' : '—'}
                              </span>
                            </div>
                            {panelData.kpis.topicSharePct && (
                              <div className="w-full bg-blue-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(panelData.kpis.topicSharePct, 100)}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </section>

                        {/* Co-funders */}
                        <section>
                          <div className="flex items-center mb-3">
                            <svg className="w-4 h-4 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <div className="text-sm font-semibold text-gray-800">Top co‑funders</div>
                          </div>
                          <div className="space-y-2">
                            {panelData.cofunders?.length ? (
                              panelData.cofunders.slice(0, 5).map((c: any, index: number) => {
                                const maxCount = Math.max(...panelData.cofunders.slice(0, 5).map((item: any) => item.count));
                                const percentage = (c.count / maxCount) * 100;
                                const colors = ['bg-amber-500', 'bg-orange-500', 'bg-red-500', 'bg-pink-500', 'bg-rose-500'];
                                
                                return (
                                  <div key={c.id} className="space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                                        {index + 1}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="truncate text-gray-700 font-medium flex-1 mr-3">{c.name}</span>
                                          <span className="tabular-nums text-gray-600 font-semibold flex-shrink-0">{c.count}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div 
                                        className={`${colors[index]} h-1.5 rounded-full transition-all duration-500`}
                                        style={{ width: `${percentage}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">No co‑funder relationships found</div>
                            )}
                          </div>
                        </section>

                        {/* Research Focus */}
                        <section>
                          <div className="flex items-center mb-3">
                            <svg className="w-4 h-4 text-indigo-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <div className="text-sm font-semibold text-gray-800">Research focus</div>
                          </div>
                          <div className="space-y-3">
                            {panelData.topicMix.groups?.slice(0, 5).map((g: any, index: number) => {
                              const maxCount = Math.max(...(panelData.topicMix.groups?.slice(0, 5).map((item: any) => item.count) || [1]));
                              const percentage = (g.count / maxCount) * 100;
                              const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                              
                              return (
                                <div key={g.key} className="space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="truncate text-gray-700 font-medium flex-1 mr-3">{g.key_display_name || g.key}</span>
                                    <span className="tabular-nums text-gray-600 font-semibold flex-shrink-0">{g.count.toLocaleString()}</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div 
                                      className={`${colors[index]} h-2 rounded-full transition-all duration-700 ease-out`}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>

                        {/* Top Sources */}
                        <section>
                          <div className="flex items-center mb-3">
                            <svg className="w-4 h-4 text-emerald-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                            </svg>
                            <div className="text-sm font-semibold text-gray-800">Top sources</div>
                          </div>
                          <div className="space-y-2">
                            {panelData.venues.groups?.slice(0, 6).map((g: any, index: number) => {
                              const maxCount = Math.max(...(panelData.venues.groups?.slice(0, 6).map((item: any) => item.count) || [1]));
                              const percentage = (g.count / maxCount) * 100;
                              const colors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500'];
                              
                              return (
                                <div key={g.key} className="space-y-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 w-3 h-3 rounded-full bg-gray-300 flex items-center justify-center">
                                      <div 
                                        className={`w-2 h-2 rounded-full ${colors[index]}`}
                                      ></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="truncate text-gray-700 font-medium flex-1 mr-3">{g.key_display_name || g.key}</span>
                                        <span className="tabular-nums text-gray-600 font-semibold flex-shrink-0">{g.count.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`${colors[index]} h-1.5 rounded-full transition-all duration-500`}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>


                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-2xl mb-2">👆</div>
                    <div className="text-sm">Click a node to view details</div>
                    <div className="text-xs mt-2 text-gray-400">
                      Explore funding patterns, co-funder relationships, and research focus
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-2">👆</div>
                <div className="text-sm">Click a node to view details</div>
                <div className="text-xs mt-2 text-gray-400">
                  Explore funding patterns, co-funder relationships, and research focus
                </div>
              </div>
            </div>
          )}
            </div>

            {/* Graph Panel */}
            <div className="flex-1 border-r border-gray-200 relative">
          {graph ? (
            <>
              <svg ref={svgRef} className="w-full h-full"></svg>
              <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
                {graph.nodes.length} funders • {graph.edges.length} connections • {selectedTopics.map(t => t.display_name).join(', ')} • {graph.meta.fromYear}
              </div>
              <button 
                onClick={() => {
                  const svg = d3.select(svgRef.current);
                  const zoom = d3.zoom();
                  svg.transition()
                    .duration(750)
                    .call(zoom.transform as any, d3.zoomIdentity);
                }}
                className="absolute bottom-4 left-4 bg-white/90 hover:bg-white text-gray-700 px-3 py-1 rounded text-xs border border-gray-200 shadow-sm transition-colors"
              >
                Reset View
              </button>
              <div className="absolute top-4 right-4 bg-white/95 p-3 rounded-lg shadow-sm max-w-64 max-h-80 overflow-y-auto border border-gray-200">
                <div className="space-y-1">
                  {graph.nodes.map((node: any, index: number) => {
                    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
                    const color = colors[index % colors.length];
                    return (
                      <div key={node.id} className="flex items-center space-x-2 text-xs hover:bg-gray-50 p-1 rounded">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-300" 
                          style={{ backgroundColor: color }}
                        ></div>
                        <span className="text-gray-700 truncate" title={node.name}>
                          {node.name.length > 20 ? node.name.substring(0, 20) + '...' : node.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-4xl mb-4">📊</div>
                <div className="text-sm">Build a map to visualize the funder network</div>
              </div>
            </div>
          )}
            </div>

            {/* Papers Panel */}
            <div className="w-1/3 p-4 relative">
          {selectedNode && panelData && panelData.exemplars && panelData.exemplars.length > 0 ? (
            <div className="h-full flex flex-col">
              {/* Paper card takes up full panel */}
              <div className="flex-1">
              
                {(() => {
                  const work = panelData.exemplars[currentWorkIndex];
                  
                  // Helper function to get first author
                  const getFirstAuthor = (authorships: any[]) => {
                    if (!authorships || authorships.length === 0) return null;
                    const firstAuthor = authorships[0];
                    return firstAuthor.author?.display_name || 'Unknown Author';
                  };
                  
                  // Helper function to reconstruct abstract from inverted index
                  const getAbstract = (abstractInvertedIndex: any) => {
                    if (!abstractInvertedIndex) return null;
                    
                    // Convert inverted index to text
                    const words: { [key: number]: string } = {};
                    for (const [word, positions] of Object.entries(abstractInvertedIndex)) {
                      if (Array.isArray(positions)) {
                        positions.forEach((pos: number) => {
                          words[pos] = word;
                        });
                      }
                    }
                    
                    const maxPos = Math.max(...Object.keys(words).map(Number));
                    let abstract = '';
                    for (let i = 0; i <= maxPos; i++) {
                      if (words[i]) {
                        abstract += (i > 0 ? ' ' : '') + words[i];
                      }
                    }
                    
                    return abstract || null;
                  };
                  
                  const firstAuthor = getFirstAuthor(work.authorships || []);
                  const abstract = getAbstract(work.abstract_inverted_index);
                  const source = work.primary_location?.source?.display_name;
                  
                  return (
                    <div className="h-full flex flex-col rounded-lg p-4">
                      <div className="flex-1 overflow-y-auto">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 line-clamp-3 leading-tight">
                          {work.display_name}
                        </h4>
                        
                        <div className="space-y-2 text-sm">
                          {firstAuthor && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-700 min-w-0 flex-shrink-0">Author:</span>
                              <span className="text-gray-900 font-medium">
                                {firstAuthor}
                                {work.authorships && work.authorships.length > 1 && ' et al.'}
                              </span>
                            </div>
                          )}
                          
                          {source && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-700 min-w-0 flex-shrink-0">Source:</span>
                              <span className="text-gray-900 font-medium">{source}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700 flex-shrink-0">Year:</span>
                            <span className="text-gray-900 font-medium">{work.publication_year}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700 flex-shrink-0">Citations:</span>
                            <span className="text-gray-900 font-medium">{work.cited_by_count?.toLocaleString() ?? 0}</span>
                          </div>
                          
                          {work.open_access?.is_oa && (
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold border border-green-200">
                                Open Access
                              </span>
                            </div>
                          )}
                          
                          {work.grants && work.grants.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-700 min-w-0 flex-shrink-0">Funders:</span>
                              <div className="flex-1 max-h-20 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                                <div className="flex flex-wrap gap-1">
                                  {(() => {
                                    // Deduplicate funders by name and combine counts
                                    const funderMap = new Map();
                                    work.grants.forEach((grant: any) => {
                                      const funderName = grant.funder_display_name || grant.funder?.split('/').pop() || 'Unknown Funder';
                                      const isSelectedFunder = grant.funder === selectedNode.id;
                                      
                                      if (funderMap.has(funderName)) {
                                        const existing = funderMap.get(funderName);
                                        existing.count += 1;
                                        if (isSelectedFunder) {
                                          existing.isSelected = true;
                                        }
                                      } else {
                                        funderMap.set(funderName, {
                                          name: funderName,
                                          count: 1,
                                          isSelected: isSelectedFunder,
                                          id: grant.funder
                                        });
                                      }
                                    });
                                    
                                    return Array.from(funderMap.values()).map((funder, index) => (
                                      <span
                                        key={index}
                                        className={`px-2 py-1 rounded-full text-xs font-medium truncate max-w-32 ${
                                          funder.isSelected
                                            ? 'bg-blue-100 text-blue-800 border border-blue-200 font-bold'
                                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                                        }`}
                                        title={funder.count > 1 ? `${funder.name} (${funder.count} grants)` : funder.name}
                                      >
                                        {funder.name}
                                        {funder.count > 1 && ` (${funder.count})`}
                                      </span>
                                    ));
                                  })()}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {abstract && (
                            <div className="mt-4 pt-3 border-t border-gray-200">
                              <div className="flex items-start gap-2">
                                <span className="font-semibold text-gray-700 min-w-0 flex-shrink-0">Abstract:</span>
                                <div className="flex-1 max-h-32 overflow-y-auto">
                                  <p className="text-gray-700 text-sm leading-relaxed">
                                    {abstract}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-3 border-t border-gray-200 flex-shrink-0">
                        <a
                          href={work.id}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          View Paper
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  );
                })()}
              </div>
              
              {/* Navigation controls - sleek and minimal */}
              <div className="flex justify-center items-center gap-6 mt-6 flex-shrink-0">
                <button
                  onClick={() => setCurrentWorkIndex(Math.max(0, currentWorkIndex - 1))}
                  disabled={currentWorkIndex === 0}
                  className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm text-gray-500">
                  {currentWorkIndex + 1} of {panelData.exemplars.length}
                </span>
                <button
                  onClick={() => setCurrentWorkIndex(Math.min(panelData.exemplars.length - 1, currentWorkIndex + 1))}
                  disabled={currentWorkIndex === panelData.exemplars.length - 1}
                  className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
              
              {/* Title in bottom right */}
              <div className="absolute bottom-4 right-4 text-xs text-gray-500">
                Top Papers • {selectedNode.name} • {selectedTopics.map(t => t.display_name).join(', ')}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-2">📄</div>
                <div className="text-sm">No example works available</div>
                <div className="text-xs mt-1">Select a funder to view their publications</div>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}