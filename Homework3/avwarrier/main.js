import('https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js');

const winW = window.innerWidth;
const winH = window.innerHeight;

const legendWidth   = winW * 0.02;
const legendPadding = winW * 0.04;

// Heatmap dimensions
const margin = {
  top:    winH * 0.30,
  right:  0,
  bottom: winH * 0.06,
  left:   winW * 0.1
};
const width  = ((winW * 0.45) - margin.left - margin.right);
const height = (winH * 0.8) - margin.top  - margin.bottom;
const totalWidth = width + margin.left + margin.right + legendWidth + legendPadding;

// Bar chart dimensions
const margin2 = {
  top:    winH * 0.25,
  right:  winW * 0.02,
  bottom: winH * 0.06,
  left:   winW * 0.06
};
const width2  = width
const height2 = height

// Sankey dimensions
const mK = {
  top:    winH * 0.06,
  right:  winW * 0.05,
  bottom: winH * 0.05,
  left:   winW * 0.05
};
const wK = winW * 0.9;  // 90% of width
const hK = winH * 0.80; // 85% of height


d3.csv('./data/ds_salaries.csv', d3.autoType).then(async data => {
  // Put job titles into top 5 categories, or other
  function normalizeTitle(job) {
    if (job.includes('Data Engineer')) return 'Data Engineer';
    if (job.includes('Data Scientist')) return 'Data Scientist';
    if (job.includes('Data Analyst')) return 'Data Analyst';
    if (job.includes('Machine Learning Engineer')) return 'ML Engineer';
    if (job.includes('Analytics Engineer')) return 'Analytics Engineer';
    return 'Other';
  }

  // Only Show sankey
  d3.select('#heatmap').style('display', 'none');
  d3.select('#barchart').style('display', 'none');

  // Back button (initially hidden)
  const backBtn = d3.select('body').append('button')
    .attr('id', 'back-btn')
    .text('< Back')
    .style('position', 'fixed')
    .style('top', '20px')
    .style('left', '20px')
    .style('display', 'none')
    .style('padding', '8px 12px')
    .style('font-size', '14px')
    .on('click', () => {
      // When going back, hide focus views
      d3.select('#heatmap').style('display', 'none');
      d3.select('#barchart').style('display', 'none');
      d3.select('#sankey').style('display', 'block');
      // Reset sankey zoom
      d3.select('#sankey-wrapper').select('svg')
        .transition().duration(500)
        .style('transform', 'translate(0px,0px) scale(1)');
      backBtn.style('display', 'none');
    });
  
  // Heatmap tooltip
  const tooltip = d3.select('#heatmap')
    .append('div')
    .attr('class', 'tooltip');

  // Bar chart tooltip
  const tooltip2 = d3.select('#barchart')
    .append('div')
    .attr('class', 'tooltip');

// Heatmap
  const svg = d3.select('#heatmap')
    .append('svg')
    .attr('width', totalWidth)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);
    
  // Add title for heatmap
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", winH * -0.1)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Salary per Job Type over Time");
  
  // Selected Levels(rows) on Heatmap
  const selectedLevels = new Set();

  // Scales for heatmap
  const x = d3.scaleBand()
    .range([0, width])
    .padding(0.05);

  const y = d3.scaleBand()
    .range([0, height])
    .padding(0.05);

  // Color scale for heatmap
  const color = d3.scaleSequential()
    .interpolator(d3.interpolateViridis);

  // Axes for heatmap
  svg.append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${height})`);

  svg.append('g')
    .attr('class', 'y-axis');

  // X-axis label
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Work Year");

  // Y-axis label
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -margin.left + 60)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Job Title");

  // Function to update heatmap selection opacity
  function updateHeatmapSelection() {
    svg.selectAll('rect.heat')
      .attr('opacity', d => selectedLevels.size === 0 || selectedLevels.has(d.title) ? 1 : 0.2)
  }

  // Function to draw the heatmap for a given job role
  function drawHeatmapForLevel(level) {
    // Order of Y-axis
    const baseOrder = ['Data Engineer','Data Scientist','Data Analyst','ML Engineer','Analytics Engineer'];

    // Compute top 5 job titles for this level
    let titlesForLevel;
    if (level) {
      titlesForLevel = Array.from(
        d3.rollup(
          data.filter(d => d.experience_level === level),
          v => v.length,
          d => normalizeTitle(d.job_title)
        )
      )
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 5)
      .map(d => d[0]);
    } else {
      titlesForLevel = ['Data Engineer','Data Scientist','Data Analyst','ML Engineer', 'Analytics Engineer'];
    }

    // Filter data for selected experience level
    const filteredData = level ? data.filter(d => d.experience_level === level) : data;

    // Average salary by job title and year
    let nestedHM = d3.rollups(
      filteredData,
      v => d3.mean(v, d => d.salary_in_usd),
      d => normalizeTitle(d.job_title),
      d => d.work_year
    );

    nestedHM = nestedHM.filter(([title]) => titlesForLevel.includes(title));

    // Build Array and full grid
    const heatDataHM = [];
    nestedHM.forEach(([title, arr]) => {
      arr.forEach(([year, avg]) => {
        heatDataHM.push({ title, year: year.toString(), avg });
      });
    });

    // Fill in missing grid cells for all years/titles
    const xLv = Array.from(new Set(heatDataHM.map(d => d.year))).sort();

    // Enforce base order, and append "Other" at end if necessary
    const yLv = baseOrder.filter(t => titlesForLevel.includes(t));
    if (nestedHM.some(([title]) => title === 'Other')) {
      yLv.push('Other');
    }

    const fullHM = [];
    yLv.forEach(title => {
      xLv.forEach(year => {
        const match = heatDataHM.find(h => h.title === title && h.year === year);
        fullHM.push({ title, year, avg: match ? match.avg : null });
      });
    });

    // Update color scale domain based on data
    color.domain(d3.extent(heatDataHM, d => d.avg));

    // Update axes domains
    x.domain(xLv);
    y.domain(yLv);
    svg.select('g.x-axis').call(d3.axisBottom(x))
      .selectAll('text')
        .attr('transform', 'rotate(-40)')
        .style('text-anchor', 'end');
    svg.select('g.y-axis').call(d3.axisLeft(y));

    // Bind data and redraw cells
    const cells = svg.selectAll('rect.heat')
      .data(fullHM, d => d.title + ':' + d.year);
    cells.join(
      enter => enter.append('rect').attr('class','heat'),
      update => update,
      exit => exit.remove()
    )
      .attr('x', d => x(d.year))
      .attr('y', d => y(d.title))
      .attr('width',  x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => d.avg == null ? '#ccc' : color(d.avg))
      .attr('opacity', 1)
      .attr('stroke', 'none')
      .on('mouseover', (event, d) => {

        // No selection: per-cell tooltip
        if (selectedLevels.size === 0) {
          const [mx, my] = d3.pointer(event, d3.select('#heatmap').node());
          tooltip
            .style('opacity', 1)
            .html(`Year: ${d.year}<br>Title: ${d.title}<br>Avg: \$${d.avg != null ? d.avg.toFixed(0) : 'N/A'}`)
            .style('left',  (mx + 15) + 'px')
            .style('top',   (my - 25) + 'px');
          return;
        }

        // If there is a selection, ignore rows not in that set
        if (!selectedLevels.has(d.title)) return;

        // Compute combined average across all selected titles
        const combinedCells = fullHM.filter(h => selectedLevels.has(h.title) && h.avg != null);
        const combinedAvg = d3.mean(combinedCells, h => h.avg);

        // Build a comma-separated list of selected titles
        const titlesList = Array.from(selectedLevels).join(', ');
        const [mx, my] = d3.pointer(event, d3.select('#heatmap').node());
        tooltip
          .style('opacity', 1)
          .html(`Titles: ${titlesList}<br>Avg over Role(s): \$${combinedAvg.toFixed(0)}`)
          .style('left',  (mx + 15) + 'px')
          .style('top',   (my - 25) + 'px');
      })
      .on('mousemove', (event, d) => {
        if (selectedLevels.size > 0 && !selectedLevels.has(d.title)) return;
        const [mx, my] = d3.pointer(event, d3.select('#heatmap').node());
        tooltip
          .style('left',  (mx + 15) + 'px')
          .style('top',   (my - 25) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('opacity', 0);
      })
      .on('click', (event, d) => {
        // Toggle selection of this title
        if (selectedLevels.has(d.title)) {
          selectedLevels.delete(d.title);
        } else {
          selectedLevels.add(d.title);
        }
        updateHeatmapSelection();
      });
    // After drawing, update selection styling
    updateHeatmapSelection();
  }

  // Initial heatmap creation: show all top titles (no experience level selected)
  drawHeatmapForLevel(null);

  // Legend for heatmap
  const legendHWidth = width;
  const legendHeight = 10;

  const defsH = svg.append("defs");
  const gradientH = defsH.append("linearGradient")
    .attr("id", "heat-legend-gradient")
    .attr("x1", "0%").attr("y1", "0%")
    .attr("x2", "100%").attr("y2", "0%");

  gradientH.selectAll("stop")
    .data(color.ticks().map((t, i, n) => ({ offset: `${100 * i / (n.length - 1)}%`, color: color(t) })))
    .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

  // Legend group on top
  const legendH = svg.append("g")
    .attr("transform", `translate(0, ${-margin.top / 2})`);

  // Draw gradient bar
  legendH.append("rect")
    .attr("y", height * 0.28)
    .attr("width", legendHWidth)
    .attr("height", legendHeight)
    .style("fill", "url(#heat-legend-gradient)");

  // Legend axis
  const legendHScale = d3.scaleLinear()
    .domain(color.domain())
    .range([0, legendHWidth]);

  const legendHAxis = d3.axisTop(legendHScale)
    .ticks(5)
    .tickFormat(d3.format("$,"));

  legendH.append("g")
    .attr("transform", `translate(0, ${height * 0.28})`)
    .call(legendHAxis)
    .call(g => g.select(".domain").remove());

  // Legend title
  legendH.append("text")
    .attr("x", legendHWidth / 2)
    .attr("y", height * 0.2)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Avg Salary (USD)");
    
// Bar chart  
  const barchartSvg = d3.select('#barchart')
    .append('svg')
    .attr('width', width2 + margin2.left + margin2.right)
    .attr('height', height2 + margin2.top + margin2.bottom);
  
  // Add title directly to the SVG
  barchartSvg.append("text")
    .attr("x", (width2 + margin2.left + margin2.right) / 2)
    .attr("y", winH * 0.15)
    .attr("text-anchor", "middle")
    .style("font-size", "16px")
    .style("font-weight", "bold")
    .text("Remote Work Salaries per Experience Level");
  
  // Add the main chart group after the title
  const svg2 = barchartSvg.append('g')
    .attr('transform', `translate(${margin2.left},${margin2.top})`);
  
  // Prepare grouped data
  const grouped = d3.rollups(
    data,
    v => d3.mean(v, d => d.salary_in_usd),
    d => d.remote_ratio,
    d => d.experience_level
  );
  
  // Convert to array of objects
  const barData = [];
  grouped.forEach(([remote, arr]) => {
    const obj = { remote };
    arr.forEach(([level, avg]) => { obj[level] = avg; });
    barData.push(obj);
  });
  
  // Sort by remote ratio ascending
  barData.sort((a, b) => a.remote - b.remote);
  
  // Scales for bar chart
  const levels = ['EN','MI','SE','EX'];
  const x0 = d3.scaleBand()
    .domain(barData.map(d => d.remote))
    .range([0, width2])
    .padding(0.2);
  
  const x1 = d3.scaleBand()
    .domain(levels)
    .range([0, x0.bandwidth()])
    .padding(0.05);
  
  const y2 = d3.scaleLinear()
    .domain([0, d3.max(barData, d => d3.max(levels, l => d[l]))]).nice()
    .range([height2, 0]);
  
  const color2 = d3.scaleOrdinal()
    .domain(levels)
    .range(d3.schemeTableau10);
  
  // Axes for bar chart
  svg2.append('g')
    .attr('transform', `translate(0,${height2})`)
    .call(d3.axisBottom(x0).tickFormat(d => d + '%'));
    
  svg2.append('g')
    .call(d3.axisLeft(y2));

  // X-axis label
  svg2.append("text")
    .attr("x", width2 / 2)
    .attr("y", height2 + margin2.bottom - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Remote Work Ratio (%)");

  // Y-axis label
  svg2.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height2 / 2)
    .attr("y", -margin2.left + 15)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Average Salary (USD)");
  
  // Top-centered legend for bar chart
  const legendTop = svg2.append('g')
    .attr('transform', `translate(${width2 / 2}, ${winH * -0.05})`);
  
  legendTop.append('text')
    .attr('x', 0)
    .attr('y', -10)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .text('Experience Level');
    
  levels.forEach((l, i) => {
    legendTop.append('rect')
      .attr('x', (i - levels.length / 2) * 60)
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', color2(l));
    legendTop.append('text')
      .attr('x', (i - levels.length / 2) * 60 + 20)
      .attr('y', 12)
      .text(l)
      .style('font-size', '12px')
      .attr('text-anchor', 'start');
  });
  
  // Selection state for bar chart experience levels
  const selectedBarLevels = new Set();

  // Function to update bar chart styling based on selection
  function updateBarFilter() {
    console.log(selectedBarLevels);
    svg2.selectAll('rect.bar-rect')
      .attr('opacity', d => selectedBarLevels.size === 0 || selectedBarLevels.has(d.level) ? 1 : 0.1);
  }

  // Bars
  svg2.selectAll('g.layer')
    .data(barData)
    .join('g')
      .attr('transform', d => `translate(${x0(d.remote)},0)`)
    .selectAll('rect')
    .data(d => levels.map(l => ({level: l, value: d[l]})))
    .join('rect')
      .attr('class', 'bar-rect')
      .attr('x', d => x1(d.level))
      .attr('y', d => y2(d.value))
      .attr('width', x1.bandwidth())
      .attr('height', d => height2 - y2(d.value))
      .attr('fill', d => color2(d.level))
      .on('mouseover', (event, d) => {
        if (selectedBarLevels.size > 0 && !selectedBarLevels.has(d.level)) {
          return;
        }
        const [mx, my] = d3.pointer(event, d3.select('#barchart').node());
        tooltip2
          .style('opacity', 1)
          .html(`Level: ${d.level}<br>Avg: \$${d.value.toFixed(0)}`)
          .style('left', (mx + 15) + 'px')
          .style('top', (my - 25) + 'px');
      })
      .on('mousemove', function(event, d) {
        if (selectedBarLevels.size > 0 && !selectedBarLevels.has(d.level)) {
          return;
        }
        const [mx, my] = d3.pointer(event, d3.select('#barchart').node());
        tooltip2
          .style('left', (mx + 15) + 'px')
          .style('top', (my - 25) + 'px');
      })
      .on('mouseout', function() {
        tooltip2.style('opacity', 0);
      })
      .on('click', (event, d) => {
        // Toggle selection of this level
        if (selectedBarLevels.has(d.level)) {
          selectedBarLevels.delete(d.level);
        } else {
          selectedBarLevels.add(d.level);
        }
        updateBarFilter();
      });
  // Initialize bar selection styling after drawing bars
  updateBarFilter();
 

// Sankey
  d3.select('#sankey').html('');

  // Sankey wrapper for pan/zoom
  const sankeyWrapper = d3.select('#sankey')
    .append('div')
      .attr('id', 'sankey-wrapper')
      .style('overflow', 'hidden')
      .style('width', (wK + mK.left + mK.right) + 'px')
      .style('margin', '0 auto');

  const svgK = sankeyWrapper
    .append('svg')
      .attr('width', wK + mK.left + mK.right)
      .attr('height', hK + mK.top + mK.bottom)
      .style('display', 'block')
      .style('margin', '0 auto')
      .style('transform-origin', '0 0')
    .append('g')
      .attr('transform', `translate(${mK.left},${mK.top})`);
      
  // Add title for Sankey diagram
  svgK.append('text')
    .attr('x', wK / 2 - 150).attr('y', -10)
    .attr('text-anchor', 'middle')
    .style('font-size', '16px').style('font-weight', 'bold')
    .text('Job Title → Experience Level → Salary Band');

  // Data preparation for Sankey
  const topTitles = Array.from(
    d3.rollup(data, v => v.length, d => d.job_title)
  )
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 5)
    .map(d => d[0]);

  const expLevels = ['EN', 'MI', 'SE', 'EX'];
  const salaryBands = [
    { lbl:'<75k',      lo:0,      hi:75000 },
    { lbl:'75–125k',   lo:75000,  hi:125000 },
    { lbl:'125–175k',  lo:125000, hi:175000 },
    { lbl:'>175k',     lo:175000, hi:Infinity }
  ];

  // Build nodes
  const nodes = [
    ...topTitles.map(n => ({ name: n })),
    ...expLevels.map(n => ({ name: n })),
    ...salaryBands.map(b => ({ name: b.lbl }))
  ];
  const idx = n => nodes.findIndex(o => o.name === n);

  // Build links (title -> exp)
  const links = [];
  topTitles.forEach(t => {
    expLevels.forEach(e => {
      const v = data.filter(d => d.job_title === t &&
                               d.experience_level === e).length;
      if (v) links.push({ source: idx(t), target: idx(e), value: v });
    });
  });
  
  // Links (exp -> salary band)
  expLevels.forEach(e => {
    salaryBands.forEach(b => {
      const v = data.filter(d =>
        d.experience_level === e &&
        d.salary_in_usd >= b.lo && d.salary_in_usd < b.hi
      ).length;
      if (v) links.push({ source: idx(e), target: idx(b.lbl), value: v });
    });
  });

  // Sankey layout
  const { sankey, sankeyLinkHorizontal } = d3;
  const sankeyGen = sankey()
    .nodeWidth(18)
    .nodePadding(12)
    .extent([[0,0],[wK,hK]]);

  const graph = sankeyGen({
    nodes: nodes.map(d => ({ ...d })),
    links: links.map(d => ({ ...d }))
  });

  // Wrapper group for links and nodes
  const sankeyContent = svgK.append('g')
    .attr('class', 'sankeyContent')
    .attr('transform', 'translate(0, 20)');

  // Color by job title
  const col = d3.scaleOrdinal(d3.schemeCategory10).domain(topTitles);

  // Links
  sankeyContent.append('g').selectAll('path')
    .data(graph.links)
    .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('fill', 'none')
      .attr('stroke', d => col(topTitles.includes(d.source.name)
                                ? d.source.name : '#666'))
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', d => Math.max(1, d.width));

  // Nodes
  const gNodes = sankeyContent.append('g').selectAll('g')
    .data(graph.nodes)
    .join('g');

  gNodes.append('rect')
    .attr('x', d => d.x0).attr('y', d => d.y0)
    .attr('width', sankeyGen.nodeWidth())
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => col(topTitles.includes(d.name) ? d.name : '#999'))
    .attr('stroke', '#000');

  gNodes.append('text')
    .attr('x', d => d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .text(d => d.name)
    .filter(d => d.x0 < wK / 2)
    .attr('x', d => d.x1 + 6)
    .attr('text-anchor', 'start');

  const levelZoom = {
    'SE': -0.50,
    'EX' : -1.30,
    'MI': -1.60,
    'EN': -2.00
  }

  // Click on experience-level nodes to switch to detail view with smooth pan/zoom
  gNodes
    .filter(d => ['EN', 'MI', 'SE', 'EX'].includes(d.name))
    .style('cursor', 'pointer')
    .on('click', (event, d) => {
      const level = d.name;
      // Animate Sankey zoom in
      sankeyWrapper.select('svg')
        .transition().duration(1000)
        .styleTween('transform', () =>
          d3.interpolateString('translate(0px,0px) scale(1)', `translate(-1600px,${levelZoom[level] * winH}px) scale(3)`)
        )
        .on('end', () => {
          // After animation, switch views
          d3.select('#sankey').style('display', 'none');
          d3.select('#heatmap').style('display', 'block');
          d3.select('#barchart').style('display', 'block');
          backBtn.style('display', 'block');

          // Set detail filters for heatmap
          selectedBarLevels.clear();
          selectedBarLevels.add(level);
          updateBarFilter();
          
          // Draw heatmap for selected experience level
          drawHeatmapForLevel(level);
        });
    });

  // Legend for experience levels
  const legend = svgK.append('g')
    .attr('transform', `translate(${wK * 0.6}, -40)`);

  // Experience‑level legend items
  const expLegend = [
    { code: 'EN', desc: 'Entry‑level' },
    { code: 'MI', desc: 'Mid‑level' },
    { code: 'SE', desc: 'Senior‑level' },
    { code: 'EX', desc: 'Executive‑level' }
  ];

  // Add a box around legend items
  legend.append('rect')
    .attr('x', -8)
    .attr('y', 0)
    .attr('width', 240)
    .attr('height', expLegend.length * 12)
    .attr('fill', 'none')
    .attr('stroke', 'black')
    .attr('stroke-width', 1);

  expLegend.forEach((d, i) => {
    if (i % 2 == 0) {
      legend.append('text')
      .attr('x', i * 50)
      .attr('y', 20)
      .style('font-size', '12px')
      .text(`${d.code} — ${d.desc}`);
    } else {
      legend.append('text')
      .attr('x', i * 50 - 50)
      .attr('y', 40)
      .style('font-size', '12px')
      .text(`${d.code} — ${d.desc}`);
    }
  });
});