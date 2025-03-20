import React, { useState } from "react";
import { DataFrame } from "data-forge";
import Papa from "papaparse";

// Convert empty strings to null values and handle any other preprocessing
function cleanData(df) {
  return new DataFrame(df.toRows().filter((row) => {
    // Check if the row contains any non-empty value
    return row.some((value) => value !== null && value !== undefined && value !== "");
  }).map((row) => {
    let cleanedRow = {};
    df.getColumnNames().forEach((col, index) => {
      let value = row[index];
      
      // Check for empty string, "TRUE", "FALSE", null, undefined
      if (value === "" && typeof value !== 'string') {
        cleanedRow[col] = value === '' || value === undefined ? '' : value;
      } else if (value === undefined) {
        cleanedRow[col] = '';  // Null or undefined becomes empty string
      } else if (typeof value === 'object') {
        cleanedRow[col] = '';  // Null or undefined becomes empty string
      } else {
        cleanedRow[col] = value;  // Leave other values unchanged
      }
    });
    return cleanedRow;
  }));
}

const CsvAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [stats, setStats] = useState([]);
  const [badRows, setBadRows] = useState([]);
  const [error, setError] = useState(null);
  const [validRows, setValidRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  // Handle file selection
  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    setFile(uploadedFile);
  };

  const inferType = (arr) => {
    // Filter out empty values (null, undefined, and empty strings)
    const filteredArr = arr.filter(value => value !== null && value !== undefined && value !== '');
  
    // Check if the filtered array contains only 0 and 1
    const isbooleanArray = filteredArr.every(value => value === 0 || value === 1);
    
    if (isbooleanArray) {
      return 'boolean';  // Return 'boolean' for arrays with only 0s and 1s
    }
  
    const typeCounts = filteredArr.reduce((counts, value) => {
      const type = typeof value;
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    
    // Find the type with the highest count
    const majorityType = Object.keys(typeCounts).reduce((majority, type) => {
      if (typeCounts[type] > typeCounts[majority]) {
        return type;
      }
      return majority;
    });
  
    return majorityType;
  }  

  const countUniqueValues = (arr) => {
    const count = {};  // Create an object to store the counts
    arr.forEach((item) => {
      // Increment the count for each item
      item = item.toString();
      count[item] = count[item] ? count[item] + 1 : 1;
    });
    return Object.keys(count).length;
  }

  // Analyze CSV content
  const analyzeCsv = async () => {
    if (!file) return alert("Please upload a CSV file.");

    try {
      // Read CSV content
      const text = await file.text();

      // Parse CSV using PapaParse
      Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        complete: (result) => {
          // Convert to DataFrame and clean data
          let dfCsv = new DataFrame(result.data);
          let dfCsvClean = cleanData(dfCsv); // Clean the data

          console.log("Data Preview:", dfCsvClean.head(50).toString());

          const badRowsList = [];
          let validRowCount = 0;

          // Generate column stats and check for bad rows
          const columnStats = dfCsvClean.getColumnNames().map((col) => {
            const column = dfCsvClean.getSeries(col);
            const values = column.toArray();
            const nanCount = values.filter((value) => value.toString() === "").length;

            // Inferred type for the column
            const inferredType = inferType(values);
            let typeMismatchCount = 0;

            values.forEach((value, rowIndex) => {
              // Check for type mismatch
              const isValueMissing = value === null || value === undefined || value.toString() === "";
              const isTypeMismatch =
                value !== null &&
                value !== undefined &&
                typeof value !== inferredType &&
                !(inferredType === "boolean" && (value === 0 || value === 1));

              if (isValueMissing || isTypeMismatch) {
                typeMismatchCount++;
                badRowsList.push({ column: col, rowIndex, value });
              }
            });

            // Filter numeric values for statistical analysis
            const numericValues = values.filter(
              (value) => value !== null && value !== undefined && !isNaN(value)
            );

            // If the column doesn't have any numeric values, return basic stats
            if (inferredType !== "number") {
              return {
                column: col,
                inferredType,
                typeMismatchCount,
                mean: "N/A",
                median: "N/A",
                min: "N/A",
                max: "N/A",
                uniqueCount: countUniqueValues(values),
                nanCount,
              };
            }

            // Compute statistics
            const mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
            const median = numericValues.sort((a, b) => a - b)[Math.floor(numericValues.length / 2)];
            const min = Math.min(...numericValues);
            const max = Math.max(...numericValues);
            const uniqueCount = new Set(numericValues).size;

            return {
              column: col,
              inferredType,
              typeMismatchCount,
              mean: mean.toExponential(2),
              median: median,
              min,
              max,
              uniqueCount,
              nanCount,
            };
          });

          // Calculate the number of valid rows
          const totalRows = dfCsvClean.count();
          const invalidRowIndexes = new Set(badRowsList.map((row) => row.rowIndex));
          validRowCount = totalRows - invalidRowIndexes.size;

          console.log("Valid Rows:", validRowCount);
          console.log("Total Rows:", totalRows);

          setStats(columnStats);
          setBadRows(badRowsList);
          setTotalRows(totalRows);
          setValidRows(validRowCount); // Store valid row count in state
          setError(null);
        },
        error: (err) => {
          throw new Error(err.message);
        },
      });
    } catch (err) {
      console.error("Error analyzing CSV:", err);
      setError("Failed to process the CSV file.");
    }
  };

  return (
    <div class="container">
      <h1>CSV Data Analyzer</h1>

      <div style={{ display: "flex", flexDirection: 'row', justifyContent: 'space-between' }}>
        <input type="file" accept=".csv" onChange={handleFileChange} style={{width: '50%'}} />
        {file && <button onClick={analyzeCsv} style={{backgroundColor: '#2FA84F'}}>Analyze CSV</button>}
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {stats.length > 0 && (
        <div>
          <div style={{display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
            <h3>Data Statistics</h3> <span style={{marginRight: '0.25rem'}}>Valid/Total Rows: <b>{validRows}/{totalRows}</b></span>
          </div>
          <table style={{width: '100%'}}>
            <thead>
              <tr>
                <th>Column</th>
                <th>Inferred Type</th>
                <th>Mean</th>
                <th>Median</th>
                <th>Min</th>
                <th>Max</th>
                <th>Unique Values</th>
                <th>Type Mismatch</th>
                <th>NaN</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.column}>
                  <td>{stat.column}</td>
                  <td>{stat.inferredType}</td>
                  <td>{stat.mean}</td>
                  <td>{stat.median}</td>
                  <td>{stat.min}</td>
                  <td>{stat.max}</td>
                  <td>{stat.uniqueCount}</td>
                  <td>{stat.typeMismatchCount}</td>
                  <td>{stat.nanCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {badRows.length > 0 ? <div>
          <h3>Bad Rows</h3>
          <table>
            <thead>
              <tr>
                <th>Column</th>
                <th>Row Index</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
            {badRows.map((row) => (
              <tr key={`${row.rowIndex}-${row.column}`}>
                 <td>{row.column}</td>
                <td>{row.rowIndex + 1}</td>
                <td>{row.value === '' ? 'EMPTY' : row.value.toString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>:
        <div style={{borderRadius: '0.5rem', backgroundColor: '#f7f9fa', padding: '0.5rem'}}>
          No bad rows detected. Data looks clean! 😀
        </div>}
        </div>
      )}
    </div>
  );
};

export default CsvAnalyzer;
