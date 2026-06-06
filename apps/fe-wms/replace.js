const fs = require('fs');

function fixTransferTab() {
    const p = 'src/components/features/transfers/CreateTransferTab.tsx';
    let c = fs.readFileSync(p, 'utf8');
    
    c = c.replace('}, [step, sourceWarehouseId, destWarehouseId, isIntra, items]);', 
                  '}, [step, sourceWarehouseId, destWarehouseId, isIntra, items, files, processConfig]);');
                  
    c = c.replace('<div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-4">', 
                  '<div className="flex-1 flex flex-col rounded-xl border border-gray-100 bg-white p-4 lg:p-4">');

    const s1Target = `                {step === 1 && (
                    <div className="space-y-4">
                        <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                            <FileUploadField`;
    const s1Replace = `                {step === 1 && (
                    <section className="flex-1 flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                        <FileUploadField`;
    
    const endS1Target = `                            />
                        </section>
                    </div>
                )}`;
    const endS1Replace = `                            />
                    </section>
                )}`;
                
    c = c.replace(s1Target, s1Replace).replace(endS1Target, endS1Replace);
    fs.writeFileSync(p, c);
}

function fixExportTab() {
    const p = 'src/components/features/export-vouchers/CreateExportTab.tsx';
    let c = fs.readFileSync(p, 'utf8');
    
    c = c.replace('}, [step, warehouseId, exportType, destinationWarehouseId, notes, items]);', 
                  '}, [step, warehouseId, exportType, destinationWarehouseId, notes, items, files, processConfig]);');
                  
    c = c.replace('<div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-4">', 
                  '<div className="flex-1 flex flex-col rounded-xl border border-gray-100 bg-white p-4 lg:p-4">');

    const s1Target = `                {step === 1 && (
                    <FileUploadField
                        files={files}
                        onFilesChange={setFiles}
                        disabled={isSubmitting}
                        maxFiles={5}
                        label={copy.uploadLabel}
                        hint={copy.uploadHint}
                    />
                )}`;
                
    const s1Replace = `                {step === 1 && (
                    <section className="flex-1 flex flex-col rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                        <FileUploadField
                            files={files}
                            onFilesChange={setFiles}
                            disabled={isSubmitting}
                            maxFiles={5}
                            label={copy.uploadLabel}
                            hint={copy.uploadHint}
                        />
                    </section>
                )}`;
                
    c = c.replace(s1Target, s1Replace);
    fs.writeFileSync(p, c);
}

fixTransferTab();
fixExportTab();
console.log("Done");
