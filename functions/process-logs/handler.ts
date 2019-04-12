import {
  Handler,
  CloudWatchLogsDecodedData,
  FirehoseTransformationEvent,
  KinesisStreamRecord,
  CloudWatchLogsEvent,
} from 'aws-lambda'
import { gunzipSync } from 'zlib'
import { processAll } from './lib'

const parsePayload = (awslog: { data: string }) => {
  const payload = new Buffer(awslog.data, 'base64')
  const json = gunzipSync(payload).toString('utf8')
  return JSON.parse(json) as CloudWatchLogsDecodedData
}

const isFirehoseTransformationEvent = (event: any) =>
  event.records && event.deliveryStreamArn.startsWith('arn:aws:firehose:')

const getRecords = (event: any): CloudWatchLogsDecodedData[] => {
  // Cloudwatch Event
  if (event.awslogs) {
    return [parsePayload((event as CloudWatchLogsEvent).awslogs)]
  }

  // Kinesis Stream Event
  if (event.Records) {
    return event.Records.filter(
      record => record.eventSource === 'aws:kinesis'
    ).map((record: KinesisStreamRecord) => parsePayload(record.kinesis))
  }

  // Kinesis Firehose Event
  if (isFirehoseTransformationEvent(event)) {
    return (event as FirehoseTransformationEvent).records.map(parsePayload)
  }

  console.warn('No records to parse.')
  return []
}

const handlerFunction: Handler = async (event, _context) => {
  const records = getRecords(event)

  try {
    // once decoded, the CloudWatch invocation event looks like this:
    // {
    //     "messageType": "DATA_MESSAGE",
    //     "owner": "374852340823",
    //     "logGroup": "/aws/lambda/big-mouth-dev-get-index",
    //     "logStream": "2018/03/20/[$LATEST]ef2392ba281140eab63195d867c72f53",
    //     "subscriptionFilters": [
    //         "LambdaStream_logging-demo-dev-ship-logs"
    //     ],
    //     "logEvents": [
    //         {
    //             "id": "33930704242294971955536170665249597930924355657009987584",
    //             "timestamp": 1521505399942,
    //             "message": "START RequestId: e45ea8a8-2bd4-11e8-b067-ef0ab9604ab5 Version: $LATEST\n"
    //         },
    //         {
    //             "id": "33930707631718332444609990261529037068331985646882193408",
    //             "timestamp": 1521505551929,
    //             "message": "2018-03-20T00:25:51.929Z\t3ee1bd8c-2bd5-11e8-a207-1da46aa487c9\t{ \"message\": \"found restaurants\" }\n",
    //             "extractedFields": {
    //                 "event": "{ \"message\": \"found restaurants\" }\n",
    //                 "request_id": "3ee1bd8c-2bd5-11e8-a207-1da46aa487c9",
    //                 "timestamp": "2018-03-20T00:25:51.929Z"
    //             }
    //         }
    //     ]
    // }

    for (const { logGroup, logStream, logEvents } of records) {
      await processAll(logGroup, logStream, logEvents)
      console.log(`Successfully processed ${logEvents.length} log events.`)
    }

    if (isFirehoseTransformationEvent(event)) {
      return { records }
    }
    return
  } catch (error) {
    console.error('Error while shipping logs.', error)
    throw error
  }
}

export const handler = handlerFunction
