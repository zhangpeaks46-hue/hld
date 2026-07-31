<?php
/**
 * 文档文本提取器
 *
 * - DOCX：原生解析（基于 ZipArchive 读取 word/document.xml，无需第三方库）
 * - PDF：优先使用 smalot/pdfparser（需 composer require smalot/pdfparser），
 *        未安装时降级为简单文本提取（可能丢失部分文本，建议安装 pdfparser）
 * - TXT/MD：直接读取
 */
class DocumentTextExtractor
{
    /**
     * 从文件中提取纯文本
     *
     * @param string $filePath 文件绝对路径
     * @return string 提取出的文本
     */
    public static function extract($filePath)
    {
        if (!is_file($filePath)) {
            throw new RuntimeException('文件不存在: ' . $filePath);
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

        switch ($ext) {
            case 'docx':
                return self::extractDocx($filePath);
            case 'pdf':
                return self::extractPdf($filePath);
            case 'txt':
            case 'md':
                return file_get_contents($filePath);
            default:
                return '';
        }
    }

    /**
     * 解析 DOCX - 读取 ZIP 内的 word/document.xml，剥离标签
     */
    private static function extractDocx($filePath)
    {
        if (!class_exists('ZipArchive')) {
            throw new RuntimeException('服务器未启用 PHP Zip 扩展，无法解析 DOCX');
        }

        $zip = new ZipArchive();
        if ($zip->open($filePath) !== true) {
            throw new RuntimeException('无法打开 DOCX 文件');
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();

        if ($xml === false) {
            throw new RuntimeException('DOCX 文件结构异常');
        }

        // 段落之间插入换行
        $xml = str_replace(
            ['</w:p>', '<w:br/>', '<w:br />'],
            ["\n", "\n", "\n"],
            $xml
        );

        // 剥离所有 XML 标签，保留文本
        $text = strip_tags($xml);

        // 处理 XML 实体
        $text = html_entity_decode($text, ENT_QUOTES | ENT_XML1, 'UTF-8');

        // 合并多余空行
        $text = preg_replace('/\n{3,}/', "\n\n", $text);

        return trim($text);
    }

    /**
     * 解析 PDF - 优先使用 smalot/pdfparser，未安装时降级
     */
    private static function extractPdf($filePath)
    {
        // 尝试使用 smalot/pdfparser
        if (class_exists('Smalot\\PdfParser\\Parser')) {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($filePath);
            return $pdf->getText();
        }

        // 降级方案：尝试 pdftotext 命令行工具（Linux 常通过 poppler-utils 安装）
        $pdftotext = self::findExecutable('pdftotext');
        if ($pdftotext) {
            $tmp = tempnam(sys_get_temp_dir(), 'pdf_') . '.txt';
            $cmd = escapeshellarg($pdftotext) . ' ' . escapeshellarg($filePath) . ' ' . escapeshellarg($tmp);
            @exec($cmd, $output, $ret);
            if ($ret === 0 && is_file($tmp)) {
                $text = file_get_contents($tmp);
                @unlink($tmp);
                return $text;
            }
            @unlink($tmp);
        }

        // 最终降级：提示用户安装依赖
        throw new RuntimeException(
            'PDF 解析需要安装 smalot/pdfparser（推荐）或系统 pdftotext 工具。'
            . '在网站根目录执行：composer require smalot/pdfparser'
        );
    }

    private static function findExecutable($name)
    {
        $where = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'where' : 'which';
        @exec("$where $name 2>&1", $out, $ret);
        if ($ret === 0 && !empty($out[0]) && is_executable($out[0])) {
            return $out[0];
        }
        return null;
    }
}
