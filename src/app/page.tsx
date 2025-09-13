'use client';

import { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge, GraphResponse, OpenAlexTopic, OpenAlexAutocomplete } from '../lib/types';

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
  const [textInput, setTextInput] = useState<string>('');
  const [annotatedTopics, setAnnotatedTopics] = useState<OpenAlexTopic[]>([]);
  const [activeTab, setActiveTab] = useState<'topics' | 'text'>('topics');
  
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
      .on('click', (_event: any, d: any) => {
        // Remove selection from all rings
        rings.style('opacity', 0);
        // Add selection ring to clicked node
        rings.filter((node: any) => node.id === d.id)
          .style('opacity', 1);
        setSelectedNode(d);
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
      {/* 4-Panel Layout */}
      <div className="grid grid-cols-12 grid-rows-12 h-full w-full">
        
        {/* Top Left Panel - Search/Input */}
        <div className="col-span-3 row-span-6 border border-gray-200 p-6">
          <div className="h-full flex flex-col">
            <h1 className="text-2xl font-bold text-indigo-700 mb-6">funderscape.</h1>
            
            <div className="flex-1 space-y-4">
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
                      className="w-full px-3 py-2 border border-gray-200 rounded-sm focus:outline-none focus:border-gray-400 text-sm font-medium text-gray-900"
                    />
                    {isSearchingTopics && (
                      <div className="absolute right-3 top-2.5">
                        <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                      </div>
                    )}
                    
                    {/* Dropdown with search results */}
                    {showTopicDropdown && topicSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-sm shadow-lg max-h-48 overflow-y-auto">
                        {topicSearchResults.map((topic) => (
                          <div
                            key={topic.id}
                            onClick={() => addTopic(topic)}
                            className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{topic.display_name}</div>
                            {topic.hint && (
                              <div className="text-gray-500 text-xs">{topic.hint}</div>
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
                      <div className="flex flex-wrap gap-2">
                        {selectedTopics.map((topic) => (
                          <div
                            key={topic.id}
                            className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-800 rounded-sm text-xs"
                          >
                            <span>{topic.display_name}</span>
                            <button
                              onClick={() => removeTopic(topic.id)}
                              className="hover:bg-indigo-200 rounded-full p-0.5"
                            >
                              ×
                            </button>
                          </div>
                        ))}
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
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Found Topics:</h4>
                      <div className="space-y-2">
                        {annotatedTopics.slice(0, 3).map((topic) => (
                          <div
                            key={topic.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-sm"
                          >
                            <div>
                              <div className="text-sm font-medium">{topic.display_name}</div>
                              <div className="text-xs text-gray-500">{topic.id}</div>
                            </div>
                            <button
                              onClick={() => addTopicFromAnnotation(topic)}
                              className="px-2 py-1 text-xs bg-gray-900 text-white rounded-sm hover:bg-gray-800 transition-colors"
                            >
                              Add
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
                className="w-full px-4 py-2 bg-gray-900 text-white rounded-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Building...' : 'Build Map'}
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Left Panel - Funder Card */}
        <div className="col-span-3 row-span-12 border border-gray-200 p-6">
          {selectedNode ? (
            <div className="h-full overflow-y-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-4">{selectedNode.name}</h3>
              
              <div className="space-y-6">
                {/* Key Statistics */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">📊 Key Statistics</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-indigo-600">{selectedNode.count}</div>
                      <div className="text-gray-600">Works in Topic</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedNode.trend ? selectedNode.trend.reduce((sum: number, year: any) => sum + year.works_count, 0) : 'N/A'}
                      </div>
                      <div className="text-gray-600">Total Works (5yr)</div>
                    </div>
                  </div>
                </div>

                {/* Funder Share */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">🎯 Topic Share</h4>
                  <div className="text-sm text-gray-600">
                    This funder represents <span className="font-semibold text-indigo-600">
                      {graph ? Math.round((selectedNode.count / graph.nodes.reduce((sum: number, node: any) => sum + node.count, 0)) * 100) : 0}%
                    </span> of all funding in this topic area.
                  </div>
                </div>

                {/* Top Co-funders */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">🤝 Top Co-funders</h4>
                  <div className="space-y-2">
                    {graph ? (() => {
                      console.log('Debug - selectedNode.id:', selectedNode.id);
                      console.log('Debug - graph.edges:', graph.edges);
                      const coFunderEdges = graph.edges.filter((edge: any) => edge.source === selectedNode.id || edge.target === selectedNode.id);
                      console.log('Debug - coFunderEdges:', coFunderEdges);
                      const maxCoFunderWeight = coFunderEdges.length > 0 ? Math.max(...coFunderEdges.map((e: any) => e.weight)) : 0;
                      return coFunderEdges
                        .sort((a: any, b: any) => b.weight - a.weight)
                        .slice(0, 5)
                        .map((edge: any, index: number) => {
                          const coFunderId = edge.source === selectedNode.id ? edge.target : edge.source;
                          console.log('Debug - coFunderId:', coFunderId);
                          const coFunder = graph.nodes.find((node: any) => node.id === coFunderId);
                          console.log('Debug - coFunder found:', coFunder);
                          if (!coFunder) return null; // Skip if co-funder not found
                          const strength = maxCoFunderWeight > 0 ? Math.round((edge.weight / maxCoFunderWeight) * 100) : 0;
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                            <span className="text-gray-700 truncate flex-1 mr-2">{coFunder.name}</span>
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-indigo-500 h-2 rounded-full" 
                                  style={{ width: `${strength}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500 w-8">{strength}%</span>
                            </div>
                          </div>
                        );
                        }).filter(Boolean);
                      })() : null}
                    {graph && (() => {
                      const coFunderEdges = graph.edges.filter((edge: any) => edge.source === selectedNode.id || edge.target === selectedNode.id);
                      return coFunderEdges.length === 0 ? (
                        <div className="text-sm text-gray-500 italic">No co-funder relationships found</div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Geographic Distribution */}
                {selectedNode.countries && selectedNode.countries.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">🌍 Geographic Reach</h4>
                    <div className="space-y-1">
                      {selectedNode.countries.slice(0, 4).map((country: any) => (
                        <div key={country.code} className="flex justify-between text-sm">
                          <span className="text-gray-600">{country.code}</span>
                          <span className="font-medium">{country.count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Research Focus */}
                {selectedNode.topics && selectedNode.topics.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">🔬 Research Focus</h4>
                    <div className="space-y-1">
                      {selectedNode.topics.slice(0, 4).map((topic: any) => (
                        <div key={topic.id} className="flex justify-between text-sm">
                          <span className="text-gray-600 truncate flex-1 mr-2">{topic.name}</span>
                          <span className="font-medium">{topic.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                  <div>Country: {selectedNode.country || 'Unknown'}</div>
                  <div>Data from: {graph?.meta?.fromYear || 'N/A'} - {new Date().getFullYear()}</div>
                </div>
              </div>
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

        {/* Middle Panel - Funding Map */}
        <div className="col-span-6 row-span-12 border border-gray-200 relative">
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

        {/* Top Right Panel - Example Papers */}
        <div className="col-span-3 row-span-6 border border-gray-200 p-6">
          <div className="h-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Example Papers</h3>
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-3 bg-gray-50 rounded-sm">
                  <div className="h-3 bg-gray-200 rounded mb-2"></div>
                  <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}