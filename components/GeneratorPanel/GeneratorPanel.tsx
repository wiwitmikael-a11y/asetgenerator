import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { generateImageAsset, generateWithPublicModel, generatePlaceholder } from '../../services/geminiService';
import { generateWithOpenAICompatibleModel } from '../../services/openaiService';
import { AssetType, CharacterPart, FacingDirection, GeneratedFile } from '../../types';
import { PART_DIMENSIONS } from '../../constants';
// FIX: Import `ParseResult` and `ParseError` types directly from papaparse.
// They are named exports, not properties of the default export.
import Papa, { ParseResult, ParseError } from 'papaparse';
import JSZip from 'jszip';

type GenerationMode = 'single' | 'batch' | 'upload';
type GenerationEngine = 'gemini' | 'dalle3' | 'deepseek' | 'public';

const GeneratorPanel: React.FC = () => {
  const { 
    generatedImages, 
    setGeneratedImages, 
    batchProgress, 
    setBatchProgress,
    geminiApiKey,
    setGeminiApiKey,
    openAiApiKey,
    setOpenAiApiKey,
    openAiApiEndpoint,
    setOpenAiApiEndpoint,
  } = useAppContext();
  const [mode, setMode] = useState<GenerationMode>('single');
  const [showSettings, setShowSettings] = useState(false);

  // Single Mode State
  const [masterStyle, setMasterStyle] = useState('retro-futurism, pixel art, vibrant colors');
  const [assetType, setAssetType] = useState<AssetType>(AssetType.Character);
  const [characterPart, setCharacterPart] = useState<CharacterPart>(CharacterPart.Head);
  const [facingDirection, setFacingDirection] = useState<FacingDirection>(FacingDirection.Right);
  const [width, setWidth] = useState(64);
  const [height, setHeight] = useState(64);
  const [specificPrompt, setSpecificPrompt] = useState('a stoic male hero');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numberOfVariations, setNumberOfVariations] = useState(1);
  const [engine, setEngine] = useState<GenerationEngine>('gemini');

  // Upload Mode State
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isCharacterType = assetType === AssetType.Character || assetType === AssetType.NPC;

  useEffect(() => {
    if (isCharacterType) {
      const dims = PART_DIMENSIONS[characterPart];
      setWidth(dims.width);
      setHeight(dims.height);
      setFacingDirection(assetType === AssetType.Character ? FacingDirection.Right : FacingDirection.Left);
    }
  }, [characterPart, assetType, isCharacterType]);

  const handleGenerateSingle = async () => {
    setIsLoading(true);
    setError(null);
    let fullPrompt = `${masterStyle}, ${assetType}`;
    if (isCharacterType) {
      fullPrompt += `, ${characterPart}, facing ${facingDirection}`;
    }
    fullPrompt += `, ${specificPrompt}, ${width}x${height} pixels, transparent background, centered`;
    
    const isSingleVariationEngine = engine === 'public' || engine === 'dalle3' || engine === 'deepseek';
    const clampedVariations = isSingleVariationEngine ? 1 : Math.max(1, Math.min(4, numberOfVariations || 1));

    try {
      let generateFunc: () => Promise<string>;
      if (engine === 'public') {
        generateFunc = () => generateWithPublicModel(fullPrompt, width, height);
      } else if (engine === 'dalle3') {
        generateFunc = () => generateWithOpenAICompatibleModel(fullPrompt, openAiApiKey, openAiApiEndpoint, 'dall-e-3');
      } else if (engine === 'deepseek') {
        generateFunc = () => generateWithOpenAICompatibleModel(fullPrompt, openAiApiKey, openAiApiEndpoint, 'deepseek-image-v1');
      } else { // gemini
        generateFunc = () => generateImageAsset(fullPrompt, width, height, geminiApiKey);
      }

      const promises = Array(clampedVariations).fill(0).map(generateFunc);
      const results = await Promise.allSettled(promises);

      const successfulImages = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map(result => ({ src: result.value, prompt: fullPrompt }));
      
      const failedCount = clampedVariations - successfulImages.length;

      if (successfulImages.length > 0) {
        setGeneratedImages([...successfulImages, ...generatedImages]);
      }

      if (failedCount > 0) {
        if (successfulImages.length > 0) {
          setError(`Generated ${successfulImages.length} of ${clampedVariations} variations. Some failed.`);
        } else {
          const firstError = results.find(r => r.status === 'rejected') as PromiseRejectedResult;
          const reason = firstError?.reason instanceof Error ? firstError.reason.message : "All variations failed to generate.";
          setError(reason);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, imageSrc: string, prompt: string) => {
    e.dataTransfer.setData('imageSrc', imageSrc);
    e.dataTransfer.setData('name', prompt.substring(0, 30));
  };
  
  const handleBatchFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBatchProgress({ total: 0, current: 0, status: 'processing', generatedFiles: [], currentFileName: 'Parsing CSV...' });

    // FIX: Use FileReader to read the file as text. This avoids a complex
    // TypeScript overload resolution issue with Papa.parse when passing a File object directly.
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) {
        setBatchProgress({ status: 'error', error: 'Could not read file content.', total: 0, current: 0, generatedFiles: [] });
        return;
      }
      const csvText = e.target.result as string;

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        // FIX: The boolean value `true` for the `comments` option can cause overload
        // resolution issues with some versions of papaparse's type definitions, leading
        // to an obscure "unique symbol" error. Using the default character explicitly
        // as a string is safer and functionally equivalent.
        comments: '#',
        transformHeader: (header: string) => header.trim().toLowerCase().replace(/[\s-]+/g, '_'),
        complete: async (results: ParseResult<any>) => {
          
          if (results.errors.length > 0) {
            const firstError = results.errors[0];
            setBatchProgress({ status: 'error', error: `CSV Parse Error: ${firstError.message} on row ${firstError.row + 2}.`, total: 0, current: 0, generatedFiles: [] });
            return;
          }

          const rows = results.data.filter(row => Object.values(row).some(val => val !== null && val !== ''));

          if (rows.length === 0) {
              setBatchProgress({ status: 'error', error: 'CSV is empty or contains no valid data rows.', total: 0, current: 0, generatedFiles: [] });
              return;
          }

          setBatchProgress(prev => ({ ...prev, total: rows.length, currentFileName: 'Starting generation...' }));
          
          let failures = 0;
          let firstErrorMessage = '';
          
          const onRetryCallback = (attempt: number, delay: number) => {
            setBatchProgress(prev => {
                const fileName = prev.currentFileName?.replace('Generating: ', '');
                return { 
                    ...prev, 
                    currentFileName: `Rate limit hit. Retrying ${fileName} in ${delay / 1000}s... (Attempt ${attempt})` 
                };
            });
          };

          let generateFunc: (prompt: string, width: number, height: number) => Promise<string>;

          if (engine === 'public') {
            generateFunc = (prompt, width, height) => generateWithPublicModel(prompt, width, height, onRetryCallback);
          } else if (engine === 'dalle3') {
            generateFunc = (prompt, _w, _h) => generateWithOpenAICompatibleModel(prompt, openAiApiKey, openAiApiEndpoint, 'dall-e-3');
          } else if (engine === 'deepseek') {
            generateFunc = (prompt, _w, _h) => generateWithOpenAICompatibleModel(prompt, openAiApiKey, openAiApiEndpoint, 'deepseek-image-v1');
          } else { // gemini
            generateFunc = (p, w, h) => generateImageAsset(p, w, h, geminiApiKey);
          }

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const fileNameValue = row.nama_file || row.filename || `asset_${i}`;
            const fileName = `${fileNameValue}.png`;
            const widthStr = row.lebar || row.width;
            const heightStr = row.tinggi || row.height;
            
            setBatchProgress(prev => ({ ...prev, current: i, currentFileName: `Generating: ${fileName}` }));
            
            let prompt = '';
            let width = 0;
            let height = 0;
            
            try {
               width = parseInt(widthStr, 10);
               height = parseInt(heightStr, 10);
               const assetType = row.tipe_aset || row.asset_type;
               const characterPart = row.bagian_karakter || row.character_part;
               const specificPrompt = row.prompt_spesifik || row.specific_prompt || row.prompt;
               const facingDirection = row.arah_hadap || row.facing_direction;

               if (!specificPrompt || !widthStr || !heightStr || isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
                 throw new Error(`Row ${i + 2}: Invalid or missing data. Ensure prompt, width, and height are valid.`);
               }

               const promptParts = [
                masterStyle, assetType, characterPart, specificPrompt,
                `${width}x${height}px`,
                facingDirection ? `facing ${facingDirection}` : null,
                'transparent background', 'centered',
               ];
               prompt = promptParts.filter(Boolean).join(', ');

               const imageUrl = await generateFunc(prompt, width, height);
               setBatchProgress(prev => ({...prev, generatedFiles: [...prev.generatedFiles, { filename: fileName, data: imageUrl }]}));

            } catch (e) {
               failures++;
               const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
               if (!firstErrorMessage) {
                   firstErrorMessage = `Error on ${fileName}: ${errorMessage}`;
               }
               console.error(`Failed to generate ${fileName}:`, e);
               
               const placeholderWidth = width || parseInt(widthStr, 10) || 64;
               const placeholderHeight = height || parseInt(heightStr, 10) || 64;
               
               const placeholderUrl = await generatePlaceholder(prompt || 'Invalid prompt data', placeholderWidth, placeholderHeight);
               setBatchProgress(prev => ({...prev, generatedFiles: [...prev.generatedFiles, { filename: fileName, data: placeholderUrl }]}));

            } finally {
                if (i < rows.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
          }
          
          if (failures > 0) {
              setBatchProgress(prev => ({ ...prev, status: 'error', error: `${failures} of ${rows.length} assets failed. First error: ${firstErrorMessage}`, current: rows.length, currentFileName: 'Completed with errors.' }));
          } else {
              setBatchProgress(prev => ({ ...prev, status: 'done', current: rows.length, currentFileName: 'Completed!' }));
          }
        },
        error: (err: ParseError) => {
          setBatchProgress({ status: 'error', error: `CSV Parse Error: ${err.message}`, total: 0, current: 0, generatedFiles: [] });
        }
      });
    };

    reader.onerror = () => {
      setBatchProgress({ status: 'error', error: 'Error reading the selected file.', total: 0, current: 0, generatedFiles: [] });
    };

    reader.readAsText(file);

    event.target.value = ''; // Allow re-uploading the same file
  };

  const handleUserUpload = (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
  
    const newImages: { src: string; prompt: string }[] = [];
    let loadedCount = 0;
  
    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        if (src) {
          newImages.push({ src, prompt: file.name });
        }
        loadedCount++;
        if (loadedCount === imageFiles.length) {
          setGeneratedImages([...generatedImages, ...newImages]);
        }
      };
      reader.readAsDataURL(file);
    });
  };
  
  const dataURLtoBlob = (dataurl: string) => {
      const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
  }

  const handleDownloadZip = async () => {
    if (batchProgress.generatedFiles.length === 0) return;
    const zip = new JSZip();
    batchProgress.generatedFiles.forEach(file => {
        const blob = dataURLtoBlob(file.data);
        zip.file(file.filename, blob);
    });
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nusa_fracta_batch_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isSingleVariationEngine = engine === 'public' || engine === 'dalle3' || engine === 'deepseek';
  const currentVariations = isSingleVariationEngine ? 1 : numberOfVariations;

  const settingsPanel = (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-md space-y-4">
        <h3 className="text-lg font-semibold text-gray-200">API Key Configuration</h3>
        <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="gemini-key">
                Google Gemini API Key
            </label>
            <input
                id="gemini-key"
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
            <p className="text-xs text-gray-400">
                Required for the 'Gemini' engine. Stored in session storage.
            </p>
        </div>
        <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="openai-key">
                OpenAI API Key
            </label>
            <input
                id="openai-key"
                type="password"
                value={openAiApiKey}
                onChange={(e) => setOpenAiApiKey(e.target.value)}
                placeholder="Enter your OpenAI API key"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
            <p className="text-xs text-gray-400">
                Required for 'DALL-E 3' & 'DeepSeek'. Stored in session storage.
            </p>
        </div>
        <div className="space-y-2">
            <label className="block text-sm font-medium" htmlFor="openai-endpoint">
                OpenAI API Base URL
            </label>
            <input
                id="openai-endpoint"
                type="text"
                value={openAiApiEndpoint}
                onChange={(e) => setOpenAiApiEndpoint(e.target.value)}
                placeholder="e.g., https://openrouter.ai/api/v1"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
            />
            <p className="text-xs text-gray-400">
                Defaults to OpenAI. Change to use a proxy like OpenRouter.
            </p>
        </div>
    </div>
  );

  const engineSelector = (
      <div className="space-y-2">
        <label className="block text-sm font-medium">Engine</label>
        <div className="flex bg-gray-800 rounded-md p-1">
          <button onClick={() => setEngine('gemini')} className={`w-1/4 py-1 rounded text-xs sm:text-sm ${engine === 'gemini' ? 'bg-blue-600' : 'bg-transparent hover:bg-gray-700'}`} title="Kualitas tinggi, butuh kuota API Google.">
            Gemini
          </button>
          <button onClick={() => setEngine('dalle3')} className={`w-1/4 py-1 rounded text-xs sm:text-sm ${engine === 'dalle3' ? 'bg-cyan-600' : 'bg-transparent hover:bg-gray-700'}`} title="Jago interpretasi prompt, butuh API key OpenAI. Menghasilkan gambar ukuran 1024x1024.">
            DALL-E 3
          </button>
          <button onClick={() => setEngine('deepseek')} className={`w-1/4 py-1 rounded text-xs sm:text-sm ${engine === 'deepseek' ? 'bg-purple-600' : 'bg-transparent hover:bg-gray-700'}`} title="Model DeepSeek via API OpenAI-compatible. Butuh API key. Menghasilkan gambar ukuran 1024x1024.">
            DeepSeek
          </button>
          <button onClick={() => setEngine('public')} className={`w-1/4 py-1 rounded text-xs sm:text-sm ${engine === 'public' ? 'bg-green-600' : 'bg-transparent hover:bg-gray-700'}`} title="Model publik gratis via Pollinations.ai. Kualitas bervariasi.">
            Publik
          </button>
        </div>
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex bg-gray-800 rounded-md p-1 flex-shrink-0 items-center">
        <div className="flex-grow flex rounded-md overflow-hidden bg-gray-700">
            <button onClick={() => setMode('single')} className={`flex-1 py-1 px-2 text-sm transition-colors ${mode === 'single' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>Single</button>
            <button onClick={() => setMode('batch')} className={`flex-1 py-1 px-2 text-sm border-l border-r border-gray-800 transition-colors ${mode === 'batch' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>Batch</button>
            <button onClick={() => setMode('upload')} className={`flex-1 py-1 px-2 text-sm transition-colors ${mode === 'upload' ? 'bg-blue-600' : 'hover:bg-gray-600'}`}>Upload</button>
        </div>
        <button 
            onClick={() => setShowSettings(!showSettings)} 
            className={`ml-2 p-2 rounded-md transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} 
            title="Configure API Keys"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        </button>
      </div>
      
      {showSettings && settingsPanel}

      <div className="flex-shrink-0">
        {mode === 'single' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-600 pb-2">Asset Generator</h2>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Master Style Seed</label>
              <textarea value={masterStyle} onChange={(e) => setMasterStyle(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" rows={2} />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Tipe Aset</label>
              <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">
                {Object.values(AssetType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            {isCharacterType && (
              <>
                <div className="space-y-2"><label className="block text-sm font-medium">Bagian Karakter</label><select value={characterPart} onChange={(e) => setCharacterPart(e.target.value as CharacterPart)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">{Object.values(CharacterPart).map(part => <option key={part} value={part}>{part}</option>)}</select></div>
                <div className="space-y-2"><label className="block text-sm font-medium">Arah Hadap</label><select value={facingDirection} onChange={(e) => setFacingDirection(e.target.value as FacingDirection)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md">{Object.values(FacingDirection).map(dir => <option key={dir} value={dir}>{dir}</option>)}</select></div>
              </>
            )}
            <div className="flex space-x-2">
              <div className="w-1/2"><label className="block text-sm font-medium">Lebar (px)</label><input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value, 10))} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
              <div className="w-1/2"><label className="block text-sm font-medium">Tinggi (px)</label><input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value, 10))} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
            </div>
            <div className="space-y-2"><label className="block text-sm font-medium">Prompt Spesifik</label><input type="text" value={specificPrompt} onChange={(e) => setSpecificPrompt(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md" /></div>
            
            {engineSelector}

            <div className="flex items-end space-x-2">
              <button onClick={handleGenerateSingle} disabled={isLoading} className="flex-grow py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md disabled:bg-gray-500 transition-colors">{isLoading ? `Generating ${currentVariations}...` : `Generate Asset${currentVariations > 1 ? `s (${currentVariations})` : ''}`}</button>
              <div className="w-24"><label htmlFor="variations-input" className="block text-xs font-medium text-center mb-1">Variations</label><input id="variations-input" type="number" min="1" max="4" value={currentVariations} onChange={(e) => setNumberOfVariations(Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))} className="w-full p-2 text-center bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed" disabled={isSingleVariationEngine} /></div>
            </div>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>
        )}

        {mode === 'batch' && (
          <div className="flex flex-col space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-600 pb-2">Batch Asset Generation</h2>
            
            {engineSelector}

            <div>
              <label htmlFor="csv-upload" className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors cursor-pointer text-center block">Upload File Prompt (.csv)</label>
              <input id="csv-upload" type="file" accept=".csv" onChange={handleBatchFileUpload} className="hidden" disabled={batchProgress.status === 'processing'}/>
            </div>
            {batchProgress.status !== 'idle' && (
              <div className="space-y-3">
                  <h3 className="font-semibold">Batch Progress</h3>
                  <div className="w-full bg-gray-700 rounded-full h-2.5"><div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }}></div></div>
                  <div className="text-center text-sm text-gray-400"><p>{batchProgress.current} / {batchProgress.total}</p><p className="truncate mt-1">{batchProgress.currentFileName}</p></div>
                  {batchProgress.status === 'error' && <p className="text-red-400 text-center text-sm break-words">{batchProgress.error}</p>}
              </div>
            )}
            <button onClick={handleDownloadZip} disabled={batchProgress.status !== 'done' && batchProgress.status !== 'error'} className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 rounded-md disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors">Download Batch (.zip)</button>
          </div>
        )}

        {mode === 'upload' && (
          <div className="flex flex-col space-y-4">
            <h2 className="text-xl font-bold border-b border-gray-600 pb-2">Upload Assets</h2>
            <div
              onDragEnter={() => setIsDraggingOver(true)}
              onDragLeave={() => setIsDraggingOver(false)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingOver(false);
                handleUserUpload(e.dataTransfer.files);
              }}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDraggingOver ? 'border-blue-500 bg-gray-800' : 'border-gray-500 hover:border-blue-600'}`}
            >
              <input 
                type="file" 
                id="asset-upload" 
                multiple 
                accept="image/png, image/jpeg, image/webp" 
                className="hidden" 
                onChange={(e) => handleUserUpload(e.target.files)}
              />
              <label htmlFor="asset-upload" className="cursor-pointer flex flex-col items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <p className="mt-2">Drag & drop your assets here</p>
                <p className="text-sm text-gray-400">or click to browse</p>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG, WEBP supported</p>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="flex-grow overflow-y-auto border-t border-gray-700 pt-4">
        <h3 className="text-lg font-semibold mb-2">Available Assets</h3>
        <div className="grid grid-cols-3 gap-2 pr-2">
          {generatedImages.map((img, index) => (
            <div key={index} draggable onDragStart={(e) => handleDragStart(e, img.src, img.prompt)} className="aspect-square bg-gray-700 rounded-md cursor-grab active:cursor-grabbing" title={img.prompt}>
              <img src={img.src} alt={img.prompt} className="w-full h-full object-contain" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GeneratorPanel;